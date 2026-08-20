"use server";

import { cosineSimilarity, embedMediaItems, embedQuery } from "@/lib/embeddings";
import { languagePreferenceBoost, readContentPreferences } from "@/lib/content-preferences";
import { predictPersonalRating, type PersonalModel } from "@/lib/personal-model";
import { HIGH_MATCH_THRESHOLD } from "@/lib/recommendation-selection";
import {
  getPersonallyRankedCandidates,
  getPersonalModel,
  getPersonalTasteVector,
  getRecentCandidateItems,
  getReferencedTitleRecommendations,
  getRuntimeCandidateItems,
  getSearchCandidatePool,
  resolveReferencedTitle,
} from "@/lib/recommendations";
import { getMediaCards } from "@/lib/tmdb";
import { parseSearchIntent } from "@/lib/search-intent";
import { diversifyVibeResults, filterConfidentResults, type SemanticSearchResult } from "@/lib/vibe-search";
import type { MediaItem } from "@/types/tmdb";

export type SemanticSearchState = {
  status: "idle" | "error";
  results: SemanticSearchResult[];
  message?: string;
  weakMatch?: boolean;
  appliedFilters?: string[];
};

const RESULT_COUNT = 48;
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

    const [basePool, referencedItem, personalTasteVector, personalModel, runtimeItems] = await Promise.all([
      getSearchCandidatePool(query),
      intent.referencedTitle ? resolveReferencedTitle(intent.referencedTitle, intent.mediaType) : Promise.resolve(null),
      intent.usePersonalHistory ? getPersonalTasteVector() : Promise.resolve(null),
      getPersonalModel(),
      intent.runtimeUnderMinutes ? getRuntimeCandidateItems(intent.runtimeUnderMinutes) : Promise.resolve(null),
    ]);

    const [referencedRecommendations, recentItems] = await Promise.all([
      referencedItem ? getReferencedTitleRecommendations(referencedItem) : Promise.resolve([]),
      intent.recency ? getRecentCandidateItems(intent.mediaType) : Promise.resolve([]),
    ]);

    // A runtime constraint can only be verified for movies sourced straight
    // from TMDb's own runtime filter (see getRuntimeCandidateItems) — the
    // general pool's list-endpoint items don't carry runtime data, so they'd
    // either all get dropped by a post-hoc filter or, worse, let unverified
    // titles through under a false "under N hours" claim.
    let candidates = intent.runtimeUnderMinutes && runtimeItems
      ? mergeUnique(referencedRecommendations, runtimeItems)
      : mergeUnique(referencedRecommendations, recentItems, basePool);
    if (referencedItem) candidates = candidates.filter((item) => mediaKey(item) !== mediaKey(referencedItem));
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

    if (candidates.length === 0) return { status: "idle", results: [], appliedFilters: describeIntent(intent, referencedItem, personalTasteVector) };

    const [queryVector, referencedVector, candidateVectors, preferences] = await Promise.all([
      embedQuery(query),
      referencedItem ? embedMediaItems([referencedItem]).then((vectors) => vectors.get(mediaKey(referencedItem)) ?? null) : Promise.resolve(null),
      embedMediaItems(candidates),
      readContentPreferences(),
    ]);

    const ranked = candidates
      .map((item): SemanticSearchResult | null => {
        const vector = candidateVectors.get(mediaKey(item));
        if (!vector) return null;
        let similarity = cosineSimilarity(queryVector, vector);
        if (referencedVector) similarity = similarity * 0.4 + cosineSimilarity(referencedVector, vector) * 0.6;
        if (personalTasteVector) similarity = similarity * 0.6 + cosineSimilarity(personalTasteVector, vector) * 0.4;
        return { item, similarity, predictedRating: null, predictedConfidence: null };
      })
      .filter((entry): entry is SemanticSearchResult => entry !== null)
      .sort((a, b) => (b.similarity + languagePreferenceBoost(b.item, preferences)) - (a.similarity + languagePreferenceBoost(a.item, preferences)));

    const weakMatch = (ranked[0]?.similarity ?? 0) < WEAK_MATCH_THRESHOLD;
    const diversified = diversifyVibeResults(filterConfidentResults(ranked), RESULT_COUNT);
    // candidates (and so `ranked`) are sourced from list-endpoint MediaItem
    // cards that lack keywords/cast/runtime/certification — fine for
    // similarity ranking, but predictPersonalRating needs the same full
    // profile a detail page uses to land on the same number. Re-score only
    // the diversified result set actually being returned, not the whole pool.
    const results = personalModel ? await hydratePredictedRatings(diversified, personalModel) : diversified;

    return { status: "idle", results, weakMatch, appliedFilters: describeIntent(intent, referencedItem, personalTasteVector) };
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

function describeIntent(intent: ReturnType<typeof parseSearchIntent>, referencedItem: MediaItem | null, personalTasteVector: number[] | null): string[] | undefined {
  const filters: string[] = [];
  if (referencedItem) filters.push(`Similar to ${referencedItem.title} (${referencedItem.year})`);
  else if (intent.referencedTitle) filters.push(`Couldn't find "${intent.referencedTitle}" — searched by mood instead`);
  if (intent.runtimeUnderMinutes) {
    filters.push(intent.runtimeUnderMinutes % 60 === 0 ? `Under ${intent.runtimeUnderMinutes / 60}h` : `Under ${intent.runtimeUnderMinutes} min`);
    filters.push("Movies only");
  } else if (intent.mediaType) filters.push(intent.mediaType === "tv" ? "TV shows only" : "Movies only");
  if (intent.recency === "this-year") filters.push("Released this year");
  else if (intent.recency === "recent") filters.push("Recent releases");
  if (intent.usePersonalHistory && personalTasteVector) filters.push("Based on your ratings");
  return filters.length > 0 ? filters : undefined;
}
