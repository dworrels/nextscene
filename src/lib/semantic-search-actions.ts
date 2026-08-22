"use server";

import { cosineSimilarity, embedMediaItems, embedQuery } from "@/lib/embeddings";
import { languagePreferenceBoost, readContentPreferences } from "@/lib/content-preferences";
import { predictPersonalRating, type PersonalModel } from "@/lib/personal-model";
import { HIGH_MATCH_THRESHOLD } from "@/lib/recommendation-selection";
import {
  getPersonallyRankedCandidates,
  getFilteredCandidateItems,
  getPersonalModel,
  getPersonalTasteVector,
  getRecentCandidateItems,
  getReferencedTitleRecommendations,
  getSearchCandidatePool,
  resolveReferencedTitle,
} from "@/lib/recommendations";
import { getMediaCards, type DiscoverFeature } from "@/lib/tmdb";
import { parseSearchIntent, type SearchIntent } from "@/lib/search-intent";
import { diversifyVibeResults, filterConfidentResults, type SemanticSearchResult } from "@/lib/vibe-search";
import type { MediaItem } from "@/types/tmdb";

export type SemanticSearchState = {
  status: "idle" | "error";
  results: SemanticSearchResult[];
  message?: string;
  weakMatch?: boolean;
  noResults?: boolean;
  appliedFilters?: string[];
};

const RESULT_COUNT = 48;
const MIN_RESULT_COUNT = 24;
const RECENCY_YEARS = 2;
// Below this the top match itself is weak — a signal the query didn't land,
// not just that lower-ranked results trail off (see filterConfidentResults
// in vibe-search.ts for the per-result relative floor).
const WEAK_MATCH_THRESHOLD = 0.36;

function mediaKey(item: Pick<MediaItem, "mediaType" | "id">): string {
  return `${item.mediaType}-${item.id}`;
}

function mergeUnique(...lists: MediaItem[][]): MediaItem[] {
  const seen = new Set<string>();
  const merged: MediaItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = mediaKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function hardDiscoverFeatures(intent: SearchIntent): DiscoverFeature[] {
  const features: DiscoverFeature[] = intent.excludedGenres.map((genre) => ({ group: "exclude-genre", value: genre.tmdbName }));
  if (intent.runtimeUnderMinutes) features.push({ group: "runtime-max", value: String(intent.runtimeUnderMinutes) });
  if (intent.watchProvider) features.push({ group: "provider", value: String(intent.watchProvider.id) });
  if (intent.dateRange) features.push({ group: "date-range", value: `${intent.dateRange.start}|${intent.dateRange.end}` });
  if (intent.originalLanguage) features.push({ group: "language", value: intent.originalLanguage.code });
  if (intent.originCountry) features.push({ group: "country", value: intent.originCountry.code });
  if (intent.familyFriendly) features.push({ group: "certification-max", value: "movie=PG|tv=TV-PG" });
  if (intent.tvType) features.push({ group: "tv-type", value: "2" });
  if (intent.tvStatus) features.push({ group: "tv-status", value: intent.tvStatus.value });
  if (intent.person && intent.mediaType !== "tv") features.push({ group: intent.person.role, value: intent.person.name });
  return features;
}

function expansionDiscoverFeatures(intent: SearchIntent): DiscoverFeature[] {
  return intent.includedGenres.map((genre) => ({ group: "genre", value: genre.tmdbName }));
}

function hardConstraintMediaType(intent: SearchIntent): MediaItem["mediaType"] | null {
  if (intent.tvType || intent.tvStatus || intent.maxSeasons || intent.maxEpisodes) return "tv";
  if (intent.person && intent.mediaType !== "tv") return "movie";
  return intent.mediaType;
}

function hasTvLengthConstraint(intent: SearchIntent): boolean {
  return intent.maxSeasons !== null || intent.maxEpisodes !== null;
}

function applyListLevelFilters(items: MediaItem[], intent: SearchIntent): MediaItem[] {
  let candidates = items;
  if (intent.runtimeUnderMinutes) candidates = candidates.filter((item) => item.mediaType === "movie");
  else if (intent.mediaType) candidates = candidates.filter((item) => item.mediaType === intent.mediaType);
  if (intent.recency === "this-year") {
    const year = String(new Date().getFullYear());
    candidates = candidates.filter((item) => item.releaseDate?.startsWith(year));
  } else if (intent.recency === "recent") {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RECENCY_YEARS);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    candidates = candidates.filter((item) => item.releaseDate && item.releaseDate >= cutoffDate);
  }
  const { dateRange, originalLanguage, originCountry } = intent;
  if (dateRange) candidates = candidates.filter((item) => item.releaseDate >= dateRange.start && item.releaseDate <= dateRange.end);
  if (originalLanguage) candidates = candidates.filter((item) => item.originalLanguageCode === originalLanguage.code);
  if (originCountry) candidates = candidates.filter((item) => item.originCountryCodes?.includes(originCountry.code));
  if (intent.excludedGenres.length > 0) {
    candidates = candidates.filter((item) => {
      const genreNames = item.genres?.length ? item.genres : [item.genre];
      return !intent.excludedGenres.some((excluded) => genreNames.some((name) => excluded.matcher.test(name)));
    });
  }
  return candidates;
}

// "Surprise me" isn't a mood or a topic — embedding that phrase and ranking
// by similarity to it would just match whichever titles happen to mention
// surprise/twist in their overview. It bypasses the whole
// query-embedding/candidate-similarity pipeline below and instead shuffles a
// pool of the user's own strongest personal matches, which is what the
// phrase actually means here.
const SURPRISE_ME_POOL_SIZE = 80;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function surpriseMeResults(personalModel: PersonalModel | null): Promise<SemanticSearchState> {
  if (!personalModel) return { status: "idle", results: [], message: "Import ratings to unlock a personalized surprise pick." };
  const ranked = await getPersonallyRankedCandidates(SURPRISE_ME_POOL_SIZE);
  const strong = ranked.filter((entry) => entry.confidence !== "low" && entry.matchScore >= HIGH_MATCH_THRESHOLD);
  const draft: SemanticSearchResult[] = shuffled(strong).slice(0, RESULT_COUNT).map((entry) => ({
    item: entry.item,
    similarity: entry.personalSimilarity,
    predictedRating: null,
    predictedConfidence: null,
  }));
  const results = await hydratePredictedRatings(draft, personalModel);
  return { status: "idle", results, appliedFilters: ["A personalized surprise"] };
}

export async function semanticSearchAction(_prevState: SemanticSearchState, formData: FormData): Promise<SemanticSearchState> {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { status: "idle", results: [] };

  try {
    if (query.toLowerCase() === "surprise me") return await surpriseMeResults(await getPersonalModel());

    const intent = parseSearchIntent(query);
    if (intent.runtimeUnderMinutes && intent.mediaType === "tv") {
      return {
        status: "error",
        results: [],
        message: "Runtime filters are currently available for movies only — try removing the TV show filter.",
      };
    }

    const hardFeatures = hardDiscoverFeatures(intent);
    const expansionFeatures = expansionDiscoverFeatures(intent);
    const hasHardConstraints = hardFeatures.length > 0 || hasTvLengthConstraint(intent);
    const hardMediaType = hardConstraintMediaType(intent);
    const expansionQuery = hardFeatures.length > 0 ? [...hardFeatures, ...expansionFeatures] : expansionFeatures;
    const [basePool, referencedItems, personalTasteVector, personalModel, hardItems, expansionItems] = await Promise.all([
      hardFeatures.length > 0 ? Promise.resolve([]) : getSearchCandidatePool(query),
      Promise.all(intent.referencedTitles.map((title) => resolveReferencedTitle(title, intent.mediaType))).then((items) => items.filter((item): item is MediaItem => item !== null)),
      intent.usePersonalHistory ? getPersonalTasteVector() : Promise.resolve(null),
      getPersonalModel(),
      hardFeatures.length > 0 ? getFilteredCandidateItems(hardFeatures, hardMediaType) : Promise.resolve(null),
      expansionQuery.length > 0 ? getFilteredCandidateItems(expansionQuery, hardFeatures.length > 0 ? hardMediaType : intent.mediaType) : Promise.resolve([]),
    ]);

    const [referencedRecommendations, recentItems] = await Promise.all([
      hardFeatures.length > 0 ? Promise.resolve([]) : Promise.all(referencedItems.map(getReferencedTitleRecommendations)).then((lists) => mergeUnique(...lists)),
      intent.recency ? getRecentCandidateItems(intent.mediaType) : Promise.resolve([]),
    ]);

    // Hard constraints are sourced only from TMDb discover queries. Softer
    // signals (positive genre and title similarity) broaden that verified pool
    // or the normal semantic pool; they never discard it.
    let candidates = hardItems !== null
      ? mergeUnique(hardItems, expansionItems)
      : mergeUnique(referencedRecommendations, recentItems, basePool, expansionItems);
    if (referencedItems.length > 0) {
      const referenceKeys = new Set(referencedItems.map(mediaKey));
      candidates = candidates.filter((item) => !referenceKeys.has(mediaKey(item)));
    }
    candidates = applyListLevelFilters(candidates, intent);
    if (hardFeatures.length > 0 && candidates.length < MIN_RESULT_COUNT) {
      const [widerHardItems, widerExpansionItems] = await Promise.all([
        getFilteredCandidateItems(hardFeatures, hardMediaType, 5),
        expansionQuery.length > hardFeatures.length ? getFilteredCandidateItems(expansionQuery, hardMediaType, 5) : Promise.resolve([]),
      ]);
      candidates = applyListLevelFilters(mergeUnique(widerHardItems, widerExpansionItems).filter((item) => !referencedItems.some((reference) => mediaKey(reference) === mediaKey(item))), intent);
    }

    if (candidates.length === 0) {
      return {
        status: "idle",
        results: [],
        noResults: true,
        appliedFilters: describeIntent(intent, referencedItems, personalTasteVector),
      };
    }

    const [queryVector, referencedVectors, candidateVectors, preferences] = await Promise.all([
      embedQuery(query),
      referencedItems.length > 0 ? embedMediaItems(referencedItems).then((vectors) => referencedItems.flatMap((item) => {
        const vector = vectors.get(mediaKey(item));
        return vector ? [vector] : [];
      })) : Promise.resolve([]),
      embedMediaItems(candidates),
      readContentPreferences(),
    ]);

    const ranked = candidates
      .map((item): SemanticSearchResult | null => {
        const vector = candidateVectors.get(mediaKey(item));
        if (!vector) return null;
        let similarity = cosineSimilarity(queryVector, vector);
        if (referencedVectors.length > 0) {
          const referenceSimilarity = referencedVectors.reduce((total, referenceVector) => total + cosineSimilarity(referenceVector, vector), 0) / referencedVectors.length;
          similarity = similarity * 0.4 + referenceSimilarity * 0.6;
        }
        if (personalTasteVector) similarity = similarity * 0.6 + cosineSimilarity(personalTasteVector, vector) * 0.4;
        return { item, similarity, predictedRating: null, predictedConfidence: null };
      })
      .filter((entry): entry is SemanticSearchResult => entry !== null)
      .sort((a, b) => (b.similarity + languagePreferenceBoost(b.item, preferences)) - (a.similarity + languagePreferenceBoost(a.item, preferences)));

    const lengthFiltered = hasTvLengthConstraint(intent) ? await filterTvLength(ranked, intent) : ranked;
    if (lengthFiltered.length === 0) {
      return {
        status: "idle",
        results: [],
        noResults: true,
        appliedFilters: describeIntent(intent, referencedItems, personalTasteVector),
      };
    }
    const weakMatch = !hasHardConstraints && (lengthFiltered[0]?.similarity ?? 0) < WEAK_MATCH_THRESHOLD;
    if (weakMatch) {
      return {
        status: "idle",
        results: [],
        weakMatch: true,
        appliedFilters: describeIntent(intent, referencedItems, personalTasteVector),
      };
    }
    const diversified = diversifyVibeResults(filterConfidentResults(lengthFiltered, MIN_RESULT_COUNT), RESULT_COUNT);
    // candidates (and so `ranked`) are sourced from list-endpoint MediaItem
    // cards that lack keywords/cast/runtime/certification — fine for
    // similarity ranking, but predictPersonalRating needs the same full
    // profile a detail page uses to land on the same number. Re-score only
    // the diversified result set actually being returned, not the whole pool.
    const results = personalModel ? await hydratePredictedRatings(diversified, personalModel) : diversified;

    return { status: "idle", results, weakMatch, appliedFilters: describeIntent(intent, referencedItems, personalTasteVector) };
  } catch {
    return { status: "error", results: [], message: "Semantic search isn't available right now — check that OPENAI_API_KEY is configured." };
  }
}

async function hydratePredictedRatings(results: SemanticSearchResult[], model: PersonalModel): Promise<SemanticSearchResult[]> {
  if (results.length === 0) return results;
  const cards = await getMediaCards(results.map(({ item }) => ({ id: item.id, mediaType: item.mediaType })));
  const fullItems = results.map((result) => cards.get(mediaKey(result.item)) ?? result.item);
  const vectors = await embedMediaItems(fullItems);
  return results.map((result, index) => {
    const fullItem = fullItems[index];
    const vector = vectors.get(mediaKey(fullItem));
    const prediction = predictPersonalRating(model, fullItem, vector);
    return { ...result, predictedRating: prediction.estimatedRating, predictedConfidence: prediction.confidence };
  });
}

// Season and episode counts are not available from TMDb list endpoints. Only
// queries that ask for those constraints fetch the leading TV candidates'
// full profiles, then retain titles with verified counts.
async function filterTvLength(results: SemanticSearchResult[], intent: SearchIntent): Promise<SemanticSearchResult[]> {
  const inspect = results.filter((result) => result.item.mediaType === "tv").slice(0, 120);
  const cards = await getMediaCards(inspect.map(({ item }) => ({ id: item.id, mediaType: "tv" })));
  return results.flatMap((result) => {
    if (result.item.mediaType !== "tv") return [];
    const item = cards.get(mediaKey(result.item));
    if (!item) return [];
    if (intent.maxSeasons !== null && (item.seasonCount === null || item.seasonCount === undefined || item.seasonCount > intent.maxSeasons)) return [];
    if (intent.maxEpisodes !== null && (item.episodeCount === null || item.episodeCount === undefined || item.episodeCount > intent.maxEpisodes)) return [];
    return [{ ...result, item }];
  });
}

function describeIntent(intent: SearchIntent, referencedItems: MediaItem[], personalTasteVector: number[] | null): string[] | undefined {
  const filters: string[] = [];
  for (const item of referencedItems) filters.push(`Similar to ${item.title} (${item.year})`);
  if (referencedItems.length === 0 && intent.referencedTitles.length > 0) filters.push(`Couldn't find ${intent.referencedTitles.map((title) => `"${title}"`).join(" or ")} — searched by mood instead`);
  if (intent.person) filters.push(`${intent.person.role === "director" ? "Directed by" : "With"} ${intent.person.name}`);
  if (intent.runtimeUnderMinutes) {
    filters.push(intent.runtimeUnderMinutes % 60 === 0 ? `Under ${intent.runtimeUnderMinutes / 60}h` : `Under ${intent.runtimeUnderMinutes} min`);
    filters.push("Movies only");
  } else if (intent.mediaType) filters.push(intent.mediaType === "tv" ? "TV shows only" : "Movies only");
  if (intent.recency === "this-year") filters.push("Released this year");
  else if (intent.recency === "recent") filters.push("Recent releases");
  if (intent.dateRange) filters.push(intent.dateRange.label);
  if (intent.originalLanguage) filters.push(intent.originalLanguage.label);
  if (intent.originCountry) filters.push(intent.originCountry.label);
  if (intent.watchProvider) filters.push(`On ${intent.watchProvider.name}`);
  for (const included of intent.includedGenres) filters.push(included.label);
  for (const excluded of intent.excludedGenres) filters.push(`No ${excluded.label}`);
  if (intent.familyFriendly) filters.push("Family-friendly");
  if (intent.lowIntensity) filters.push("Lower intensity");
  if (intent.tvType) filters.push("Limited series");
  if (intent.tvStatus) filters.push(intent.tvStatus.label);
  if (intent.maxSeasons !== null) filters.push(`Up to ${intent.maxSeasons} season${intent.maxSeasons === 1 ? "" : "s"}`);
  if (intent.maxEpisodes !== null) filters.push(`Up to ${intent.maxEpisodes} episodes`);
  if (intent.usePersonalHistory && personalTasteVector) filters.push("Based on your ratings");
  return filters.length > 0 ? filters : undefined;
}
