import { cosineSimilarity, embedMediaItems, weightedTasteVector } from "@/lib/embeddings";
import { languagePreferenceBoost, readContentPreferences } from "@/lib/content-preferences";
import {
  getFeatureEvidence,
  getTopWeightedFeatures,
  predictPersonalRating,
  trainPersonalModel,
  type ConfidenceLevel,
  type PersonalModel,
} from "@/lib/personal-model";
import type { RatingRow } from "@/lib/ratings";
import { readRatings } from "@/lib/ratings";
import {
  buildProfileCategory,
  buildProfileRails,
  HIGH_MATCH_THRESHOLD,
  type ProfileCategoryKey,
  type ProfileRail,
  type RankedMediaItem,
  type RecommendationSource,
} from "@/lib/recommendation-selection";
import { extractVibeGenres } from "@/lib/vibe-search";
import {
  discoverMoviesByFeatures,
  discoverMoviesByGenre,
  discoverMoviesByProvider,
  discoverMoviesUnderRuntime,
  discoverTvByFeatures,
  discoverTvByGenre,
  discoverTvByProvider,
  getMediaCards,
  getMovieRecommendations,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  getPopularMovies,
  getPopularTvShows,
  getSearchMovies,
  getSearchTv,
  getTopRatedMovies,
  getTopRatedTvShows,
  getUpcomingMovies,
  getTvRecommendations,
  searchMovieId,
  searchTvId,
} from "@/lib/tmdb";
import type { WatchlistRow } from "@/lib/watchlist";
import { readWatchlist } from "@/lib/watchlist";
import type { MediaItem, MediaType } from "@/types/tmdb";

export type RecommendationRail = ProfileRail;
export type PersonalizedCandidate = RankedMediaItem;

const RAIL_SIZE = 16;
const PERSONAL_SEED_LIMIT = 5;
const PERSONAL_CANDIDATE_LIMIT = 100;
const DISCOVERY_CANDIDATE_LIMIT = 80;
const TASTE_DISCOVER_CANDIDATE_LIMIT = 40;
const TASTE_DISCOVER_GROUP_COUNT = 3;

export type TasteReference = { id: number; title: string; rating: number; mediaType: "movie" | "tv"; posterUrl: string | null };
export type WhyWatchReason = { heading: string; detail: string; examples: TasteReference[]; themes: string[] };
export type WhyWatchInsight = {
  fit: "strong" | "possible" | "mixed";
  matchScore: number;
  estimatedRating: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  estimatedError: number;
  ratingCount: number;
  validationCount: number;
  validationMae: number | null;
  closelyRelatedCount: number;
  comparableCount: number;
  reasons: WhyWatchReason[];
  mismatchReasons: WhyWatchReason[];
  liked: TasteReference[];
  cautions: TasteReference[];
};

type RatedMedia = { item: MediaItem; rating: number };
type TasteProfile = { rated: RatedMedia[]; tasteVector: number[] | null; model: PersonalModel | null };
type CandidateEntry = { item: MediaItem; source: RecommendationSource };
type WhatToWatchResult = { hasRatings: boolean; ratingCount: number; rails: RecommendationRail[] };
let tasteProfileCache: { key: string; promise: Promise<TasteProfile> } | null = null;
let whatToWatchCache: { key: string; builtAt: number; promise: Promise<WhatToWatchResult> } | null = null;
// Even with an unchanged profile, rebuild after this long so the ranking
// pass re-runs against the current TMDb catalog — otherwise the same rails
// would persist for as long as the server runs.
const WHAT_TO_WATCH_TTL_MS = 24 * 60 * 60 * 1000;

function mediaKey(item: Pick<MediaItem, "mediaType" | "id">): string {
  return `${item.mediaType}-${item.id}`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function knownMediaKeys(ratingRows: RatingRow[], watchlistRows: WatchlistRow[]): Set<string> {
  const known = new Set<string>();
  for (const row of ratingRows) if (row.tmdbId !== null) known.add(`${row.mediaType}-${row.tmdbId}`);
  for (const row of watchlistRows) if (row.tmdbId !== null) known.add(`${row.mediaType}-${row.tmdbId}`);
  return known;
}

async function getKnownMediaKeys(): Promise<Set<string>> {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  return knownMediaKeys(ratingRows, watchlistRows);
}

async function getRatedMediaItems(rows: RatingRow[]): Promise<RatedMedia[]> {
  const matched = rows.filter((row) => row.tmdbId !== null);
  if (matched.length === 0) return [];
  const cards = await getMediaCards(matched.map((row) => ({ id: row.tmdbId as number, mediaType: row.mediaType })));
  return matched.flatMap((row) => {
    const item = cards.get(`${row.mediaType}-${row.tmdbId}`);
    return item ? [{ item, rating: row.rating }] : [];
  });
}

// Every matched rating contributes to the signed taste vector. Cached title
// embeddings mean expanding the profile has an up-front rather than recurring cost.
async function createTasteProfile(rows: RatingRow[]): Promise<TasteProfile> {
  const rated = await getRatedMediaItems(rows);
  if (rated.length === 0) return { rated, tasteVector: null, model: null };
  const vectors = await embedMediaItems(rated.map(({ item }) => item));
  const tasteVector = weightedTasteVector(rated.flatMap(({ item, rating }) => {
    const vector = vectors.get(mediaKey(item));
    return vector ? [{ vector, rating }] : [];
  }));
  const model = trainPersonalModel(rated.map(({ item, rating }) => ({
    item,
    rating,
    vector: vectors.get(mediaKey(item)),
  })));
  return { rated, tasteVector, model };
}

async function buildTasteProfile(rows: RatingRow[]): Promise<TasteProfile> {
  const key = JSON.stringify(rows.map((row) => [row.imdbId, row.tmdbId, row.mediaType, row.rating, row.matchedAt]));
  if (tasteProfileCache?.key === key) return tasteProfileCache.promise;
  const promise = createTasteProfile(rows);
  tasteProfileCache = { key, promise };
  try {
    return await promise;
  } catch (error) {
    if (tasteProfileCache?.promise === promise) tasteProfileCache = null;
    throw error;
  }
}

async function rankCandidateEntries(entries: CandidateEntry[], profile: TasteProfile, limit = 16): Promise<PersonalizedCandidate[]> {
  const unique = [...new Map(entries.map((entry) => [mediaKey(entry.item), entry])).values()];
  if (unique.length === 0) return [];
  if (!profile.model) return unique.slice(0, limit).map(({ item, source }) => ({ item, personalSimilarity: 0, matchScore: 0, confidence: "low" as const, source }));

  const [vectors, preferences] = await Promise.all([embedMediaItems(unique.map(({ item }) => item)), readContentPreferences()]);
  return unique
    .flatMap(({ item, source }) => {
      const vector = vectors.get(mediaKey(item));
      const prediction = predictPersonalRating(profile.model as PersonalModel, item, vector);
      return [{ item, source, matchScore: prediction.matchScore, confidence: prediction.confidence, personalSimilarity: prediction.estimatedRating / 10 + languagePreferenceBoost(item, preferences) }];
    })
    .sort((a, b) => b.personalSimilarity - a.personalSimilarity)
    .slice(0, limit);
}

async function getPersonalizedCandidateEntries(ratingRows: RatingRow[], profile: TasteProfile, known: Set<string>): Promise<CandidateEntry[]> {
  const matched = ratingRows.filter((row) => row.tmdbId !== null);
  const favoriteSeeds = [...matched]
    .filter((row) => row.rating >= 7)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, PERSONAL_SEED_LIMIT);
  const seeds = favoriteSeeds.length > 0
    ? favoriteSeeds
    : [...matched].sort((a, b) => b.rating - a.rating).slice(0, PERSONAL_SEED_LIMIT);

  // Titles TMDb thinks are similar to your top-rated seeds are useful, but
  // they only cover a handful of individual titles. Querying /discover with
  // the personal model's own strongest learned features (genre, decade,
  // keyword, etc. — see getTopWeightedFeatures) surfaces matches grounded in
  // your whole rating history instead of just those few seeds.
  const discoverFeatures = profile.model ? getTopWeightedFeatures(profile.model, TASTE_DISCOVER_GROUP_COUNT) : [];

  const [personalResults, popularMovies, popularTv, topMovies, topTv, discoverMovies, discoverTv] = await Promise.all([
    Promise.all(seeds.map((row) => (
      row.mediaType === "movie"
        ? getMovieRecommendations(row.tmdbId as number).catch(() => null)
        : getTvRecommendations(row.tmdbId as number).catch(() => null)
    ))),
    getPopularMovies().catch(() => null),
    getPopularTvShows().catch(() => null),
    getTopRatedMovies().catch(() => null),
    getTopRatedTvShows().catch(() => null),
    discoverFeatures.length > 0 ? discoverMoviesByFeatures(discoverFeatures).catch(() => null) : Promise.resolve(null),
    discoverFeatures.length > 0 ? discoverTvByFeatures(discoverFeatures).catch(() => null) : Promise.resolve(null),
  ]);

  const result: CandidateEntry[] = [];
  const seen = new Set<string>();
  const add = (items: MediaItem[], source: RecommendationSource, limit: number) => {
    let added = 0;
    for (const item of items) {
      const key = mediaKey(item);
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ item, source });
      if (++added === limit) break;
    }
  };

  for (const response of personalResults) if (response) add(response.items, "personal", PERSONAL_CANDIDATE_LIMIT);
  if (discoverMovies) add(discoverMovies.items, "taste-discover", TASTE_DISCOVER_CANDIDATE_LIMIT);
  if (discoverTv) add(discoverTv.items, "taste-discover", TASTE_DISCOVER_CANDIDATE_LIMIT);
  add([
    ...(popularMovies?.items ?? []),
    ...(popularTv?.items ?? []),
    ...(topMovies?.items ?? []),
    ...(topTv?.items ?? []),
  ], "discovery", DISCOVERY_CANDIDATE_LIMIT);
  return result;
}

// Mood searches rank over a broader catalogue; explicit title/creator queries
// also receive TMDb search results so a good match is not limited to the home lists.
export async function getSearchCandidatePool(query = ""): Promise<MediaItem[]> {
  const known = await getKnownMediaKeys();
  const queryTasks = query.length >= 2
    ? [getSearchMovies(query).catch(() => null), getSearchTv(query).catch(() => null)]
    : [];
  const vibeGenres = extractVibeGenres(query);
  const broadPages = [1, 2, 3, 4, 5];
  const discoveryTasks = vibeGenres.flatMap((genre) => [
    discoverMoviesByGenre(genre.movieGenreId, 1).catch(() => null),
    discoverMoviesByGenre(genre.movieGenreId, 2).catch(() => null),
    discoverTvByGenre(genre.tvGenreId, 1).catch(() => null),
    discoverTvByGenre(genre.tvGenreId, 2).catch(() => null),
  ]);
  const responses = await Promise.all([
    ...broadPages.flatMap((page) => [
      getPopularMovies(page).catch(() => null),
      getPopularTvShows(page).catch(() => null),
      getTopRatedMovies(page).catch(() => null),
      getTopRatedTvShows(page).catch(() => null),
    ]),
    ...discoveryTasks,
    ...queryTasks,
  ]);
  const seen = new Set<string>();
  const pool: MediaItem[] = [];
  for (const response of responses) {
    for (const item of response?.items ?? []) {
      const key = mediaKey(item);
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }
  return pool;
}

// Resolves a title mentioned in a query like "movies like Taken" to its full
// MediaItem, so the caller can both anchor ranking on its embedding and pull
// TMDb's own "recommendations for this title" as bonus candidates. Tries the
// hinted media type first (from "movies like..." vs "shows like..."), then
// falls back to the other so an unhinted or mismatched guess still resolves.
export async function resolveReferencedTitle(name: string, mediaTypeHint: MediaType | null): Promise<MediaItem | null> {
  const order: MediaType[] = mediaTypeHint === "tv" ? ["tv", "movie"] : mediaTypeHint === "movie" ? ["movie", "tv"] : ["movie", "tv"];
  for (const mediaType of order) {
    const id = await (mediaType === "tv" ? searchTvId(name) : searchMovieId(name)).catch(() => null);
    if (id === null) continue;
    const cards = await getMediaCards([{ id, mediaType }]);
    const item = cards.get(`${mediaType}-${id}`);
    if (item) return item;
  }
  return null;
}

export async function getReferencedTitleRecommendations(item: MediaItem): Promise<MediaItem[]> {
  const [response, known] = await Promise.all([
    (item.mediaType === "tv" ? getTvRecommendations(item.id) : getMovieRecommendations(item.id)).catch(() => null),
    getKnownMediaKeys(),
  ]);
  return (response?.items ?? []).filter((candidate) => !known.has(mediaKey(candidate)));
}

// "Recent" candidates are sourced from TMDb's now-playing/on-the-air lists
// rather than the popular/top-rated pool getSearchCandidatePool otherwise
// uses, since a brand-new release usually hasn't accumulated enough votes to
// rank on those broader lists yet.
export async function getRecentCandidateItems(mediaType: MediaType | null): Promise<MediaItem[]> {
  const known = await getKnownMediaKeys();
  const wantsMovies = mediaType !== "tv";
  const wantsTv = mediaType !== "movie";
  const responses = await Promise.all([
    ...(wantsMovies ? [1, 2, 3].map((page) => getNowPlayingMovies(page).catch(() => null)) : []),
    ...(wantsTv ? [1, 2, 3].map((page) => getOnTheAirTvShows(page).catch(() => null)) : []),
  ]);
  const seen = new Set<string>();
  const pool: MediaItem[] = [];
  for (const response of responses) {
    for (const item of response?.items ?? []) {
      const key = mediaKey(item);
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }
  return pool;
}

// Sourced from TMDb's own runtime filter (see discoverMoviesUnderRuntime)
// rather than filtering the general candidate pool after the fact — most
// candidates there come from list endpoints that don't carry runtime data at
// all, so a post-hoc filter would either drop everything or let unverified
// titles through. Movies only; TMDb's runtime filter isn't honored for TV.
export async function getRuntimeCandidateItems(maxMinutes: number): Promise<MediaItem[]> {
  const known = await getKnownMediaKeys();
  const responses = await Promise.all([1, 2, 3].map((page) => discoverMoviesUnderRuntime(maxMinutes, page).catch(() => null)));
  const seen = new Set<string>();
  const pool: MediaItem[] = [];
  for (const response of responses) {
    for (const item of response?.items ?? []) {
      const key = mediaKey(item);
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }
  return pool;
}

// Same reasoning as getRuntimeCandidateItems: sourced from TMDb's own
// with_watch_providers filter rather than the general pool, since nothing in
// that pool carries verified provider availability. Queries both movies and
// TV unless a media type was already specified, since a provider mention
// alone doesn't say which.
export async function getWatchProviderCandidateItems(providerId: number, mediaType: MediaType | null): Promise<MediaItem[]> {
  const known = await getKnownMediaKeys();
  const movieCalls = mediaType === "tv" ? [] : [1, 2, 3].map((page) => discoverMoviesByProvider(providerId, page).catch(() => null));
  const tvCalls = mediaType === "movie" ? [] : [1, 2, 3].map((page) => discoverTvByProvider(providerId, page).catch(() => null));
  const responses = await Promise.all([...movieCalls, ...tvCalls]);
  const seen = new Set<string>();
  const pool: MediaItem[] = [];
  for (const response of responses) {
    for (const item of response?.items ?? []) {
      const key = mediaKey(item);
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(item);
    }
  }
  return pool;
}

// The signed weighted centroid of the user's rated titles (see
// weightedTasteVector) — used to blend "based on my watch history" style
// queries with the query text's own embedding rather than relying on the
// query text alone, which usually carries little content for that phrasing.
export async function getPersonalTasteVector(): Promise<number[] | null> {
  const { rows } = await readRatings();
  const profile = await buildTasteProfile(rows);
  return profile.tasteVector;
}

// Lets callers outside this module (e.g. semantic search) attach a predicted
// rating to arbitrary items via predictPersonalRating, without duplicating
// the profile-building logic.
export async function getPersonalModel(): Promise<PersonalModel | null> {
  const { rows } = await readRatings();
  const profile = await buildTasteProfile(rows);
  return profile.model;
}

export async function getPersonalizedCandidatePool(): Promise<MediaItem[]> {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  const profile = await buildTasteProfile(ratingRows);
  return (await getPersonalizedCandidateEntries(ratingRows, profile, knownMediaKeys(ratingRows, watchlistRows))).map(({ item }) => item);
}

export async function getPersonallyRankedCandidates(limit = 60): Promise<PersonalizedCandidate[]> {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  const profile = await buildTasteProfile(ratingRows);
  const candidates = await getPersonalizedCandidateEntries(ratingRows, profile, knownMediaKeys(ratingRows, watchlistRows));
  return rankCandidateEntries(candidates, profile, limit);
}

async function getFreshCandidateItems(known: Set<string>): Promise<MediaItem[]> {
  const [nowPlaying, upcoming, onTheAir] = await Promise.all([
    getNowPlayingMovies().catch(() => null),
    getUpcomingMovies().catch(() => null),
    getOnTheAirTvShows().catch(() => null),
  ]);
  return [...(nowPlaying?.items ?? []), ...(upcoming?.items ?? []), ...(onTheAir?.items ?? [])]
    .filter((item) => !known.has(mediaKey(item)));
}

async function getWatchlistItems(rows: WatchlistRow[], ratingRows: RatingRow[]): Promise<MediaItem[]> {
  const rated = new Set(ratingRows
    .filter((row) => row.tmdbId !== null)
    .map((row) => `${row.mediaType}-${row.tmdbId}`));
  const latest = [...rows]
    .filter((row) => row.tmdbId !== null && !rated.has(`${row.mediaType}-${row.tmdbId}`))
    .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))
    .slice(0, 48);
  const cards = await getMediaCards(latest.map((row) => ({ id: row.tmdbId as number, mediaType: row.mediaType })));
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  return latest.flatMap((row) => {
    const item = cards.get(`${row.mediaType}-${row.tmdbId}`);
    const key = item ? mediaKey(item) : "";
    // The live TMDb date takes precedence over the imported date, so an
    // announced title naturally becomes eligible once it is released.
    if (!item || item.releaseDate > today || seen.has(key)) return [];
    seen.add(key);
    return [item];
  });
}

// This deterministic layer is grounded in the full ratings profile. The
// optional LLM prose receives only this already-derived explanation.
export async function getWhyWatchInsight(item: MediaItem): Promise<WhyWatchInsight | null> {
  const { rows } = await readRatings();
  const profile = await buildTasteProfile(rows);
  if (!profile.model || profile.rated.length === 0) return null;

  const vectors = await embedMediaItems([item]);
  const itemVector = vectors.get(mediaKey(item));
  if (!itemVector) return null;
  const itemThemes = new Set((item.keywords?.length ? item.keywords : item.genres ?? []).map((theme) => theme.toLowerCase()));
  const sharedThemesWith = (candidate: MediaItem): string[] => {
    const candidateThemes = candidate.keywords?.length ? candidate.keywords : candidate.genres ?? [];
    return candidateThemes.filter((theme) => itemThemes.has(theme.toLowerCase()));
  };
  const valid = profile.model.examples.flatMap(({ item: ratedItem, rating, vector }) => {
    return vector ? [{
      item: ratedItem,
      rating,
      similarity: cosineSimilarity(itemVector, vector),
      sharedThemes: sharedThemesWith(ratedItem),
    }] : [];
  });
  // Embedding similarity alone can surface titles that share broad topical
  // language (e.g. an animated family film for a WWII-era biopic) without
  // sharing anything a viewer would recognize as a real reason. Titles with
  // at least one verified shared genre/keyword are ranked first; similarity
  // still orders within each group, so this narrows rather than replaces it.
  const liked = valid
    .filter((entry) => entry.rating >= 7)
    .sort((a, b) => {
      const overlapDiff = (b.sharedThemes.length > 0 ? 1 : 0) - (a.sharedThemes.length > 0 ? 1 : 0);
      return overlapDiff !== 0 ? overlapDiff : b.similarity - a.similarity;
    })
    .slice(0, 4);
  const cautions = valid.filter((entry) => entry.rating <= 4).sort((a, b) => b.similarity - a.similarity).slice(0, 1);
  const prediction = predictPersonalRating(profile.model, item, itemVector);
  const fit: WhyWatchInsight["fit"] = prediction.estimatedRating >= 8 ? "strong" : prediction.estimatedRating >= 6 ? "possible" : "mixed";
  const evidence = getFeatureEvidence(profile.model, item);
  const positiveEvidence = evidence.filter((entry) => entry.difference >= 0.25).slice(0, 2);
  // Only surface a mismatch when the evidence is actually strong — a handful of
  // ratings behind a weak signal reads as a false warning, not a real pattern.
  const negativeEvidence = evidence.filter((entry) => entry.difference <= -0.4 && entry.count >= 5).slice(0, 1);
  const closelyRelatedCount = new Set(positiveEvidence.flatMap((entry) => entry.examples.map((example) => `${example.mediaType}-${example.id}`))).size;
  const likedReferences: TasteReference[] = liked.map(({ item: ratedItem, rating }) => ({ id: ratedItem.id, title: ratedItem.title, rating, mediaType: ratedItem.mediaType, posterUrl: ratedItem.posterUrl }));
  const reasons: WhyWatchReason[] = positiveEvidence.map((entry) => ({
    heading: `Strong preference for ${entry.subject}`,
    detail: `You consistently rate ${entry.subject} highly, averaging ${entry.averageRating.toFixed(1)}/10 across ${entry.count} titles.`,
    examples: entry.examples,
    themes: [],
  }));
  if (liked[0]) {
    // Only cite titles that actually share a verified genre/keyword with this
    // item, and attribute each theme to the specific title(s) that actually
    // have it — a blended "shares X, Y, Z you liked in A, B, C, D" implies
    // every theme applies to every title, which usually isn't true even when
    // each individual theme is real (e.g. only two of four titles are WWII).
    const backedByOverlap = liked.filter((entry) => entry.sharedThemes.length > 0);
    const referenceGroup = backedByOverlap.length > 0 ? backedByOverlap : liked;
    const themeTitles = new Map<string, string[]>();
    for (const entry of referenceGroup) {
      for (const theme of entry.sharedThemes) {
        const key = theme.toLowerCase();
        themeTitles.set(key, [...(themeTitles.get(key) ?? []), entry.item.title]);
      }
    }
    const topThemes = [...themeTitles.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3);
    const detail = topThemes.length > 0
      ? `Shares ${formatList(topThemes.map(([theme, titles]) => `${theme} (${formatList(titles)})`))}.`
      : `Shares notable similarity to ${formatList(referenceGroup.map((entry) => entry.item.title))}.`;
    reasons.push({
      heading: "Similar to movies you loved",
      detail,
      examples: likedReferences,
      themes: topThemes.map(([theme]) => capitalize(theme)),
    });
  }
  if (reasons.length === 0) reasons.push({
    heading: "Broad pattern match",
    detail: `The estimate combines its metadata with patterns learned from all ${profile.model.ratingCount} matched ratings.`,
    examples: [],
    themes: [],
  });

  const mismatchReasons: WhyWatchReason[] = negativeEvidence.map((entry) => ({
    heading: capitalize(entry.subject),
    detail: `A weaker pattern for you: ${entry.averageRating.toFixed(1)}/10 across ${entry.count} ratings.`,
    examples: entry.examples,
    themes: [],
  }));
  if (cautions[0] && cautions[0].similarity >= (liked[0]?.similarity ?? 0) - 0.04) {
    mismatchReasons.push({
      heading: "Resembles a title you didn’t enjoy",
      detail: `It also resembles ${cautions[0].item.title}, which you rated ${cautions[0].rating}/10.`,
      examples: cautions.map(({ item: ratedItem, rating }) => ({ id: ratedItem.id, title: ratedItem.title, rating, mediaType: ratedItem.mediaType, posterUrl: ratedItem.posterUrl })),
      themes: [],
    });
  }

  return {
    fit,
    matchScore: prediction.matchScore,
    estimatedRating: prediction.estimatedRating,
    confidence: prediction.confidence,
    confidenceScore: prediction.confidenceScore,
    estimatedError: prediction.estimatedError,
    ratingCount: profile.model.ratingCount,
    validationCount: profile.model.validationCount,
    validationMae: profile.model.validationMae,
    reasons: reasons.slice(0, 3),
    mismatchReasons: mismatchReasons.slice(0, 1),
    closelyRelatedCount,
    comparableCount: prediction.comparableCount,
    liked: likedReferences,
    cautions: cautions.map(({ item: ratedItem, rating }) => ({ id: ratedItem.id, title: ratedItem.title, rating, mediaType: ratedItem.mediaType, posterUrl: ratedItem.posterUrl })),
  };
}

export async function getTasteSummary(limit = 12): Promise<string | null> {
  const { rows } = await readRatings();
  const matched = rows.filter((row) => row.tmdbId !== null);
  if (matched.length === 0) return null;
  const loved = [...matched].sort((a, b) => b.rating - a.rating).slice(0, limit);
  const disliked = [...matched].sort((a, b) => a.rating - b.rating).slice(0, Math.max(4, Math.floor(limit / 2)));
  const format = (row: RatingRow) => `${row.title} (${row.mediaType === "tv" ? "TV" : "movie"}) — ${row.rating}/10`;
  return `Loved:\n${loved.map(format).join("\n")}\n\nAvoid:\n${disliked.map(format).join("\n")}`;
}

// Candidate ranking runs on the same lightweight MediaItem cards discover/
// popular/top-rated list endpoints return (no keywords, cast, runtime, or
// certification — see toMovie/toTvShow in tmdb.ts), which is fine for
// ordering a large pool cheaply. But the predicted-rating badge shown on a
// card is a specific number, and predictPersonalRating's feature model and
// embedding text both depend on that metadata — scored on the thin item, the
// same title can show a different number here than on its own detail page
// (which always uses the full profile). Re-scoring only the handful of items
// actually selected for display — never the whole candidate pool — keeps
// that fix cheap and makes the two numbers agree.
//
// The re-scored number is treated as authoritative, not just a corrected
// label: this rail is explicitly ranked and gated by predicted rating (see
// HIGH_MATCH_THRESHOLD), so once the accurate score is known, the display
// order and membership should reflect it too — otherwise a title could show
// a lower badge than one ranked below it, or sit in "Top picks for you" on a
// thin-data score that the accurate one no longer clears.
async function refinePredictedBadges(rail: RecommendationRail, model: PersonalModel | null): Promise<RecommendationRail> {
  if (!rail.predictedBadges || !model || rail.items.length === 0) return rail;
  const cards = await getMediaCards(rail.items.map((item) => ({ id: item.id, mediaType: item.mediaType })));
  const fullItems = rail.items.map((item) => cards.get(mediaKey(item)) ?? item);
  const vectors = await embedMediaItems(fullItems);
  const scored = rail.items
    .map((item, index) => {
      const fullItem = fullItems[index];
      const vector = vectors.get(mediaKey(fullItem));
      const prediction = predictPersonalRating(model, fullItem, vector);
      return { item, matchScore: prediction.matchScore, confidence: prediction.confidence };
    })
    .filter((entry) => entry.matchScore >= HIGH_MATCH_THRESHOLD)
    .sort((a, b) => b.matchScore - a.matchScore);
  return {
    ...rail,
    items: scored.map((entry) => entry.item),
    predictedBadges: Object.fromEntries(scored.flatMap((entry) => entry.confidence !== "low" ? [[mediaKey(entry.item), (entry.matchScore / 10).toFixed(1)]] : [])),
  };
}

async function buildWhatToWatch(ratingRows: RatingRow[], watchlistRows: WatchlistRow[]): Promise<WhatToWatchResult> {
  const matched = ratingRows.filter((row) => row.tmdbId !== null);
  if (matched.length === 0) return { hasRatings: false, ratingCount: 0, rails: [] };

  const known = knownMediaKeys(ratingRows, watchlistRows);
  const profile = await buildTasteProfile(ratingRows);
  const [candidateEntries, freshItems, watchlistItems] = await Promise.all([
    getPersonalizedCandidateEntries(ratingRows, profile, known),
    getFreshCandidateItems(known),
    getWatchlistItems(watchlistRows, ratingRows),
  ]);
  const [ranked, fresh, watchlist] = await Promise.all([
    rankCandidateEntries(candidateEntries, profile, 120),
    rankCandidateEntries(freshItems.map((item) => ({ item, source: "discovery" as const })), profile, RAIL_SIZE),
    rankCandidateEntries(watchlistItems.map((item) => ({ item, source: "discovery" as const })), profile, RAIL_SIZE),
  ]);
  const rails = await Promise.all(buildProfileRails(ranked, fresh, watchlist, RAIL_SIZE).map((rail) => refinePredictedBadges(rail, profile.model)));
  return { hasRatings: true, ratingCount: matched.length, rails };
}

// The result is expensive to derive (TMDb candidates, embeddings, and a
// prediction pass), but depends only on the local profile. Reuse it until a
// ratings, watchlist, or preference write changes that profile version, or
// WHAT_TO_WATCH_TTL_MS elapses — whichever comes first.
export async function getWhatToWatch(): Promise<WhatToWatchResult> {
  const [{ rows: ratingRows }, { rows: watchlistRows }, preferences] = await Promise.all([
    readRatings(),
    readWatchlist(),
    readContentPreferences(),
  ]);
  const key = JSON.stringify({
    ratings: ratingRows.map((row) => [row.imdbId, row.tmdbId, row.mediaType, row.rating, row.matchedAt]),
    watchlist: watchlistRows.map((row) => [row.imdbId, row.tmdbId, row.mediaType, row.addedAt, row.status, row.matchedAt]),
    preferences,
  });
  const fresh = whatToWatchCache?.key === key && Date.now() - whatToWatchCache.builtAt < WHAT_TO_WATCH_TTL_MS;
  if (fresh && whatToWatchCache) return whatToWatchCache.promise;

  const promise = buildWhatToWatch(ratingRows, watchlistRows);
  whatToWatchCache = { key, builtAt: Date.now(), promise };
  try {
    return await promise;
  } catch (error) {
    if (whatToWatchCache?.promise === promise) whatToWatchCache = null;
    throw error;
  }
}

export async function getWhatToWatchCategory(key: ProfileCategoryKey, limit = 160): Promise<RecommendationRail | null> {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  if (!ratingRows.some((row) => row.tmdbId !== null)) return null;

  const known = knownMediaKeys(ratingRows, watchlistRows);
  const profile = await buildTasteProfile(ratingRows);
  const [candidateEntries, freshItems, watchlistItems] = await Promise.all([
    getPersonalizedCandidateEntries(ratingRows, profile, known),
    getFreshCandidateItems(known),
    getWatchlistItems(watchlistRows, ratingRows),
  ]);
  const [ranked, fresh, watchlist] = await Promise.all([
    rankCandidateEntries(candidateEntries, profile, Math.max(160, limit * 2)),
    rankCandidateEntries(freshItems.map((item) => ({ item, source: "discovery" as const })), profile, limit),
    rankCandidateEntries(watchlistItems.map((item) => ({ item, source: "discovery" as const })), profile, limit),
  ]);
  const category = buildProfileCategory(key, ranked, fresh, watchlist, limit);
  return refinePredictedBadges(category, profile.model);
}
