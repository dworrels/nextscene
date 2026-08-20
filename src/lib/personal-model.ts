import { cosineSimilarity } from "@/lib/embeddings";
import type { MediaItem, MediaType } from "@/types/tmdb";

export type ConfidenceLevel = "high" | "medium" | "low";

export type PersonalTrainingExample = {
  item: MediaItem;
  rating: number;
  vector?: number[];
};

type CoreModel = {
  meanRating: number;
  weights: Map<string, number>;
  allowedFeatures: Set<string>;
  examples: PersonalTrainingExample[];
};

export type PersonalModel = CoreModel & {
  ratingCount: number;
  calibrationSlope: number;
  calibrationIntercept: number;
  validationMae: number | null;
  validationCount: number;
};

export type PersonalPrediction = {
  estimatedRating: number;
  matchScore: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  estimatedError: number;
  nearestSimilarity: number | null;
  metadataCoverage: number;
  comparableCount: number;
};

export type FeatureEvidenceExample = { id: number; title: string; rating: number; mediaType: MediaType; posterUrl: string | null };

export type FeatureEvidence = {
  key: string;
  subject: string;
  averageRating: number;
  count: number;
  difference: number;
  examples: FeatureEvidenceExample[];
};

export type WeightedFeature = { key: string; group: string; value: string; weight: number };

const ALWAYS_ALLOWED = new Set(["numeric:audience", "numeric:year", "numeric:runtime"]);
const MODEL_EPOCHS = 240;
const RIDGE_PENALTY = 0.09;
const KEYWORD_FEATURE_LIMIT = 15;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function yearNumber(item: MediaItem): number | null {
  const value = Number(item.year);
  return Number.isInteger(value) && value >= 1880 && value <= 2200 ? value : null;
}

function featureEntries(item: MediaItem): Array<[string, number]> {
  const features: Array<[string, number]> = [];
  const genres = item.genres?.length ? item.genres : [item.genre];
  const year = yearNumber(item);
  const runtime = item.runtimeMinutes;

  features.push([`format:${item.mediaType}`, 1]);
  for (const genre of genres.slice(0, 5)) features.push([`genre:${normalized(genre)}`, 1]);
  if (item.originalLanguageCode) features.push([`language:${normalized(item.originalLanguageCode)}`, 1]);
  if (year) {
    features.push([`decade:${Math.floor(year / 10) * 10}`, 1]);
    features.push(["numeric:year", clamp((year - 2000) / 25, -2, 2)]);
  }
  if (item.audienceScore > 0) features.push(["numeric:audience", clamp((item.audienceScore - 65) / 25, -2, 2)]);
  if (runtime && runtime > 0) {
    features.push([`runtime:${runtime <= 45 ? "short" : runtime <= 105 ? "standard" : runtime <= 140 ? "long" : "very-long"}`, 1]);
    features.push(["numeric:runtime", clamp((runtime - 90) / 60, -1.5, 2)]);
  }
  for (const person of (item.people ?? []).slice(0, 6)) features.push([`person:${normalized(person)}`, 1]);
  for (const keyword of (item.keywords ?? []).slice(0, KEYWORD_FEATURE_LIMIT)) features.push([`keyword:${normalized(keyword)}`, 1]);
  for (const network of (item.networkNames ?? []).slice(0, 3)) features.push([`network:${normalized(network)}`, 1]);
  for (const country of (item.originCountryCodes ?? []).slice(0, 3)) features.push([`country:${normalized(country)}`, 1]);
  if (item.certificationCode) features.push([`certification:${normalized(item.certificationCode)}`, 1]);
  if (item.seasonCount) features.push([`seasons:${item.seasonCount === 1 ? "limited" : item.seasonCount <= 3 ? "short-run" : item.seasonCount <= 7 ? "long-run" : "very-long-run"}`, 1]);
  if (item.episodeCount) features.push([`episodes:${item.episodeCount <= 10 ? "short" : item.episodeCount <= 40 ? "medium" : item.episodeCount <= 100 ? "long" : "very-long"}`, 1]);

  return [...new Map(features).entries()];
}

function allowedFeatureSet(examples: PersonalTrainingExample[]): Set<string> {
  const counts = new Map<string, number>();
  for (const example of examples) {
    for (const key of new Set(featureEntries(example.item).map(([feature]) => feature))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([key, count]) => ALWAYS_ALLOWED.has(key) || count >= 2).map(([key]) => key));
}

function predictFeatures(model: CoreModel, item: MediaItem): number {
  let prediction = model.meanRating;
  for (const [key, value] of featureEntries(item)) {
    if (model.allowedFeatures.has(key)) prediction += (model.weights.get(key) ?? 0) * value;
  }
  return prediction;
}

function trainCore(examples: PersonalTrainingExample[]): CoreModel {
  const meanRating = examples.length > 0
    ? examples.reduce((total, example) => total + example.rating, 0) / examples.length
    : 5.5;
  const allowedFeatures = allowedFeatureSet(examples);
  const weights = new Map<string, number>([...allowedFeatures].map((key) => [key, 0]));
  const rows = examples.map((example) => ({
    rating: example.rating,
    features: featureEntries(example.item).filter(([key]) => allowedFeatures.has(key)),
  }));

  if (rows.length >= 2) {
    for (let epoch = 0; epoch < MODEL_EPOCHS; epoch++) {
      const gradients = new Map<string, number>();
      for (const row of rows) {
        let predicted = meanRating;
        for (const [key, value] of row.features) predicted += (weights.get(key) ?? 0) * value;
        const error = predicted - row.rating;
        for (const [key, value] of row.features) gradients.set(key, (gradients.get(key) ?? 0) + error * value);
      }

      const learningRate = 0.035 / (1 + epoch / 180);
      for (const key of allowedFeatures) {
        const weight = weights.get(key) ?? 0;
        const gradient = (2 * (gradients.get(key) ?? 0)) / rows.length + 2 * RIDGE_PENALTY * weight;
        weights.set(key, weight - learningRate * gradient);
      }
    }
  }

  return { meanRating, weights, allowedFeatures, examples };
}

const COMPARABLE_SIMILARITY_THRESHOLD = 0.3;

type SemanticEstimate = {
  rating: number | null;
  nearest: number | null;
  // How consistently the nearby rated titles agree with each other (1 = all
  // the same rating, 0 = wildly mixed) — four close neighbors rated
  // 9, 10, 10, 10 should read as more trustworthy than four rated 3, 10, 6, 9,
  // even though both have the same neighbor count.
  agreement: number | null;
  // How many neighbors actually clear a "meaningfully similar" bar, as
  // opposed to the model's total rating count — a handful of comparable
  // titles is a thinner basis than the same prediction backed by dozens.
  comparableCount: number;
};

function semanticEstimate(examples: PersonalTrainingExample[], vector: number[] | undefined): SemanticEstimate {
  if (!vector) return { rating: null, nearest: null, agreement: null, comparableCount: 0 };
  const neighbors = examples
    .flatMap((example) => example.vector ? [{ rating: example.rating, similarity: cosineSimilarity(vector, example.vector) }] : [])
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
  if (neighbors.length === 0) return { rating: null, nearest: null, agreement: null, comparableCount: 0 };

  let weightedRatings = 0;
  let totalWeight = 0;
  for (const neighbor of neighbors) {
    const weight = Math.max(0.01, neighbor.similarity - 0.25) ** 3;
    weightedRatings += neighbor.rating * weight;
    totalWeight += weight;
  }

  const comparable = neighbors.filter((neighbor) => neighbor.similarity >= COMPARABLE_SIMILARITY_THRESHOLD);
  const agreementPool = comparable.length >= 2 ? comparable : neighbors;
  const meanRating = agreementPool.reduce((total, neighbor) => total + neighbor.rating, 0) / agreementPool.length;
  const variance = agreementPool.reduce((total, neighbor) => total + (neighbor.rating - meanRating) ** 2, 0) / agreementPool.length;
  const agreement = clamp(1 - Math.sqrt(variance) / 3.5, 0, 1);

  return {
    rating: totalWeight > 0 ? weightedRatings / totalWeight : null,
    nearest: neighbors[0].similarity,
    agreement,
    comparableCount: comparable.length,
  };
}

function predictRaw(model: CoreModel, item: MediaItem, vector?: number[]): { rating: number; nearest: number | null; agreement: number | null; comparableCount: number } {
  const featureRating = predictFeatures(model, item);
  const semantic = semanticEstimate(model.examples, vector);
  const semanticWeight = semantic.rating === null ? 0 : model.examples.length >= 20 ? 0.42 : 0.32;
  return {
    rating: clamp(featureRating * (1 - semanticWeight) + (semantic.rating ?? 0) * semanticWeight, 1, 10),
    nearest: semantic.nearest,
    agreement: semantic.agreement,
    comparableCount: semantic.comparableCount,
  };
}

function hashKey(item: MediaItem): number {
  const value = `${item.mediaType}-${item.id}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function calibrationFrom(pairs: Array<{ predicted: number; actual: number }>): { slope: number; intercept: number } {
  if (pairs.length < 3) return { slope: 1, intercept: 0 };
  const predictedMean = pairs.reduce((total, pair) => total + pair.predicted, 0) / pairs.length;
  const actualMean = pairs.reduce((total, pair) => total + pair.actual, 0) / pairs.length;
  const variance = pairs.reduce((total, pair) => total + (pair.predicted - predictedMean) ** 2, 0);
  if (variance < 0.01) return { slope: 1, intercept: actualMean - predictedMean };
  const covariance = pairs.reduce((total, pair) => total + (pair.predicted - predictedMean) * (pair.actual - actualMean), 0);
  const slope = clamp(covariance / variance, 0.55, 1.45);
  return { slope, intercept: actualMean - slope * predictedMean };
}

export function trainPersonalModel(examples: PersonalTrainingExample[]): PersonalModel | null {
  if (examples.length === 0) return null;
  const bounded = examples.map((example) => ({ ...example, rating: clamp(example.rating, 1, 10) }));
  let calibrationSlope = 1;
  let calibrationIntercept = 0;
  let validationMae: number | null = null;
  let validationCount = 0;

  if (bounded.length >= 12) {
    const ordered = [...bounded].sort((a, b) => hashKey(a.item) - hashKey(b.item));
    const foldCount = Math.min(5, Math.max(3, Math.floor(ordered.length / 4)));
    const pairs: Array<{ predicted: number; actual: number }> = [];
    for (let fold = 0; fold < foldCount; fold++) {
      const training = ordered.filter((_, index) => index % foldCount !== fold);
      const validation = ordered.filter((_, index) => index % foldCount === fold);
      const validationModel = trainCore(training);
      for (const example of validation) {
        pairs.push({ predicted: predictRaw(validationModel, example.item, example.vector).rating, actual: example.rating });
      }
    }
    const calibrationCount = Math.max(3, Math.floor(pairs.length / 2));
    const calibrationPairs = pairs.slice(0, calibrationCount);
    const evaluationPairs = pairs.slice(calibrationCount);
    const calibration = calibrationFrom(calibrationPairs);
    calibrationSlope = calibration.slope;
    calibrationIntercept = calibration.intercept;
    validationCount = evaluationPairs.length;
    validationMae = evaluationPairs.reduce((total, pair) => total + Math.abs(clamp(pair.predicted * calibrationSlope + calibrationIntercept, 1, 10) - pair.actual), 0) / evaluationPairs.length;
  }

  return {
    ...trainCore(bounded),
    ratingCount: bounded.length,
    calibrationSlope,
    calibrationIntercept,
    validationMae,
    validationCount,
  };
}

function metadataCoverage(item: MediaItem): number {
  const available = [
    Boolean(item.genres?.length || item.genre),
    Boolean(item.originalLanguageCode),
    Boolean(yearNumber(item)),
    Boolean(item.runtimeMinutes),
    Boolean(item.people?.length),
    Boolean(item.keywords?.length),
    item.mediaType === "movie" || Boolean(item.seasonCount || item.episodeCount),
    item.audienceScore > 0,
  ].filter(Boolean).length;
  return available / 8;
}

export function predictPersonalRating(model: PersonalModel, item: MediaItem, vector?: number[]): PersonalPrediction {
  const raw = predictRaw(model, item, vector);
  const estimatedRating = Math.round(clamp(raw.rating * model.calibrationSlope + model.calibrationIntercept, 1, 10) * 10) / 10;
  const coverage = metadataCoverage(item);
  const countQuality = clamp(Math.log2(model.ratingCount + 1) / Math.log2(161), 0, 1);
  const neighborQuality = raw.nearest === null ? 0.25 : clamp((raw.nearest - 0.35) / 0.45, 0, 1);
  const validationQuality = model.validationMae === null ? 0.25 : clamp(1 - (model.validationMae - 0.65) / 2.1, 0, 1);
  // A handful of very close, tightly-agreeing ratings should be able to earn
  // real confidence on their own — not be capped just because the overall
  // rating history (countQuality) is unremarkable.
  const agreementQuality = raw.agreement ?? 0.25;
  const comparableCountQuality = clamp(raw.comparableCount / 6, 0, 1);
  let confidenceScore = Math.round(100 * (
    countQuality * 0.20
    + neighborQuality * 0.15
    + coverage * 0.10
    + validationQuality * 0.20
    + agreementQuality * 0.20
    + comparableCountQuality * 0.15
  ));
  // Without a validated model, confidence is normally capped low — but four
  // very close, tightly-agreeing ratings (e.g. 9, 10, 10, 10) are real
  // evidence on their own, so let strong local agreement raise that cap
  // instead of holding every unvalidated prediction to the same low ceiling.
  if (model.validationCount === 0) {
    const localEvidenceCap = Math.round(44 + agreementQuality * comparableCountQuality * 30);
    confidenceScore = Math.min(confidenceScore, localEvidenceCap);
  }
  const confidence: ConfidenceLevel = confidenceScore >= 72 ? "high" : confidenceScore >= 45 ? "medium" : "low";
  const estimatedError = Math.round((model.validationMae ?? clamp(2.2 - countQuality, 1.1, 2.2)) * 10) / 10;

  return {
    estimatedRating,
    matchScore: Math.round(estimatedRating * 10),
    confidence,
    confidenceScore,
    estimatedError,
    nearestSimilarity: raw.nearest,
    metadataCoverage: coverage,
    comparableCount: raw.comparableCount,
  };
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// TMDb's genre list is small and fixed, so hand-mapping to a natural
// adjective is a grammar fix for real data, not an invented category —
// unlike keyword/person values (arbitrary free text), genres can't be
// reliably conjugated with a template alone ("History" -> "historical").
const GENRE_ADJECTIVES: Record<string, string> = {
  action: "action", adventure: "adventure", animation: "animated", comedy: "comedy",
  crime: "crime", documentary: "documentary", drama: "dramatic", family: "family",
  fantasy: "fantasy", history: "historical", horror: "horror", music: "music",
  mystery: "mystery", romance: "romance", "science fiction": "sci-fi", thriller: "thriller",
  war: "war", western: "western", kids: "kids", news: "news", reality: "reality",
  soap: "soap opera", talk: "talk show", "tv movie": "made-for-TV",
  "action & adventure": "action-adventure", "sci-fi & fantasy": "sci-fi", "war & politics": "war and politics",
};

// A neutral noun phrase describing the pattern (e.g. "historical titles",
// "true-story titles", "titles from the 2010s") — used to build both a
// "Strong preference for X" heading and a "you consistently rate X highly"
// detail sentence in recommendations.ts, instead of a raw feature label.
function evidenceSubject(key: string): string {
  const [group, rawValue] = key.split(":", 2);
  const value = rawValue || "";
  if (group === "format") return value === "tv" ? "TV series" : "movies";
  if (group === "genre") return `${GENRE_ADJECTIVES[value.toLowerCase()] ?? value.toLowerCase()} titles`;
  if (group === "language") return value === "en" ? "English-original titles" : `${value.toUpperCase()}-language titles`;
  if (group === "decade") return `titles from the ${value}s`;
  if (group === "runtime") return `${value.replace("-", " ")} runtimes`;
  if (group === "person") return `titles involving ${titleCase(rawValue)}`;
  if (group === "keyword") return /true story/i.test(rawValue) ? "true-story titles" : `${rawValue}-themed titles`;
  if (group === "network") return `${titleCase(rawValue)} titles`;
  if (group === "country") return `titles from ${value.toUpperCase()}`;
  if (group === "certification") return `${value.toUpperCase()}-rated titles`;
  if (group === "seasons") return `${value.replaceAll("-", " ")} series`;
  if (group === "episodes") return `series with a ${value.replaceAll("-", " ")} episode count`;
  return rawValue;
}

export function getFeatureEvidence(model: PersonalModel, item: MediaItem): FeatureEvidence[] {
  // "decade" is excluded here even though it's a real trained feature (see
  // featureEntries): with a large rating history it tends to match a huge
  // share of the catalog itself (release years skew recent industry-wide),
  // so a high count for it describes what's in the user's library more than
  // a distinguishing reason to recommend any one title. genre/keyword/person
  // features stay because they're actually selective.
  const candidateKeys = featureEntries(item)
    .map(([key]) => key)
    .filter((key) => !key.startsWith("numeric:") && !key.startsWith("decade:"));
  const evidence: FeatureEvidence[] = [];
  for (const key of candidateKeys) {
    const matches = model.examples
      .filter((example) => featureEntries(example.item).some(([feature]) => feature === key));
    if (matches.length < 2) continue;
    const averageRating = matches.reduce((total, example) => total + example.rating, 0) / matches.length;
    const examples = [...matches]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3)
      .map((example) => ({ id: example.item.id, title: example.item.title, rating: example.rating, mediaType: example.item.mediaType, posterUrl: example.item.posterUrl }));
    evidence.push({
      key,
      subject: evidenceSubject(key),
      averageRating,
      count: matches.length,
      difference: averageRating - model.meanRating,
      examples,
    });
  }
  return evidence.sort((a, b) => Math.abs(b.difference) * Math.log2(b.count + 1) - Math.abs(a.difference) * Math.log2(a.count + 1));
}

// Feature groups with a direct or resolvable TMDb /discover equivalent — see
// buildDiscoverParams in tmdb.ts. Excludes format/seasons/episodes (no
// matching discover param) and the numeric: features (not weighted per-group).
const DISCOVERABLE_GROUPS = new Set(["genre", "decade", "language", "runtime", "certification", "country", "person", "keyword"]);

// Picks the single strongest positively-weighted feature per discoverable
// group, then returns the top `groupCount` groups by that weight. Capping to
// one feature per group and a handful of groups keeps the resulting /discover
// query an AND of a few real signals rather than an over-narrow intersection
// of everything the model has ever learned.
export function getTopWeightedFeatures(model: PersonalModel, groupCount = 3): WeightedFeature[] {
  const bestPerGroup = new Map<string, WeightedFeature>();
  for (const [key, weight] of model.weights.entries()) {
    if (weight <= 0.15) continue;
    const [group, rawValue] = key.split(":", 2);
    if (!DISCOVERABLE_GROUPS.has(group)) continue;
    const existing = bestPerGroup.get(group);
    if (!existing || weight > existing.weight) bestPerGroup.set(group, { key, group, value: rawValue || "", weight });
  }
  return [...bestPerGroup.values()].sort((a, b) => b.weight - a.weight).slice(0, groupCount);
}

