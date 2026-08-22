import type { MediaType } from "@/types/tmdb";

export type RecencyIntent = "this-year" | "recent";
export type ExcludedGenre = { label: string; matcher: RegExp };
export type WatchProviderIntent = { id: number; name: string };

export type SearchIntent = {
  mediaType: MediaType | null;
  recency: RecencyIntent | null;
  referencedTitle: string | null;
  usePersonalHistory: boolean;
  runtimeUnderMinutes: number | null;
  excludedGenres: ExcludedGenre[];
  watchProvider: WatchProviderIntent | null;
};

const TV_WORDS = /\b(?:tv shows?|tv series|television series|series)\b/i;
const MOVIE_WORDS = /\bmovies?\b/i;
const THIS_YEAR_WORDS = /\bthis year\b/i;
const RECENT_WORDS = /\brecent(?:ly)?|new(?:est)?|latest\b/i;
const HISTORY_WORDS = /\bmy (?:watch history|ratings|taste)\b|based on (?:what i(?:'ve| have) (?:watched|rated|seen)|my (?:watch history|ratings|taste))/i;
// "movies/shows like X", "similar to X", "in the style of X" — stops at end
// of string or sentence-ending punctuation so the title isn't over-captured.
const LIKE_PATTERN = /\b(?:like|similar to|reminds? me of|in the style of)\s+([^.?!,]{2,60})/i;
// Trailing connectors ("like Interstellar but simpler") aren't part of the
// title — cut the captured phrase at the first one.
const TRAILING_CONNECTOR = /\b(?:but|except|without|minus|however)\b/i;
// "under 2 hours", "under 90 minutes", "under 2h" — hours and minutes are
// captured separately since only one will match per query.
const UNDER_HOURS_PATTERN = /\bunder\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i;
const UNDER_MINUTES_PATTERN = /\bunder\s+(\d+)\s*(?:minutes?|mins?|m)\b/i;

// Genre names as TMDb actually returns them (e.g. "Science Fiction", not
// "sci-fi") — the matcher tests against MediaItem.genre/.genres, which come
// straight from TMDb's own genre list, so it has to match TMDb's naming, not
// the query's casual phrasing.
const EXCLUDABLE_GENRES: Array<{ label: string; triggerTerm: string; matcher: RegExp }> = [
  { label: "Horror", triggerTerm: "horror|scary", matcher: /horror/i },
  { label: "Comedy", triggerTerm: "comed(?:y|ies)|funny", matcher: /comedy/i },
  { label: "Romance", triggerTerm: "romance|romantic", matcher: /romance/i },
  { label: "Action", triggerTerm: "action", matcher: /action/i },
  { label: "Thriller", triggerTerm: "thrillers?", matcher: /thriller/i },
  { label: "Drama", triggerTerm: "dramas?", matcher: /drama/i },
  { label: "Documentary", triggerTerm: "documentar(?:y|ies)", matcher: /documentary/i },
  { label: "Animation", triggerTerm: "animation|animated", matcher: /animation/i },
  { label: "Sci-Fi", triggerTerm: "sci[- ]?fi|science fiction", matcher: /sci-fi|science fiction/i },
  { label: "War", triggerTerm: "war", matcher: /\bwar\b/i },
  { label: "Crime", triggerTerm: "crime", matcher: /crime/i },
  { label: "Mystery", triggerTerm: "myster(?:y|ies)", matcher: /mystery/i },
  { label: "Western", triggerTerm: "westerns?", matcher: /western/i },
  { label: "Fantasy", triggerTerm: "fantasy", matcher: /fantasy/i },
  { label: "Musical", triggerTerm: "musicals?", matcher: /music/i },
];
const NEGATION_PREFIX = "(?:not|no|non-?|avoid|skip|without|nothing)\\s+(?:a\\s+|an\\s+|any\\s+)?";

function parseExcludedGenres(query: string): ExcludedGenre[] {
  return EXCLUDABLE_GENRES
    .filter((genre) => new RegExp(`\\b${NEGATION_PREFIX}(?:${genre.triggerTerm})\\b`, "i").test(query))
    .map((genre) => ({ label: genre.label, matcher: genre.matcher }));
}

// Provider ids verified live against TMDb's /watch/providers/movie list
// (watch_region=US) rather than assumed — some services list several SKUs
// (e.g. Paramount+ has separate "Essential"/"Premium" tiers); the id picked
// here is the general-availability flatrate entry.
const WATCH_PROVIDERS: Array<{ id: number; name: string; terms: RegExp }> = [
  { id: 8, name: "Netflix", terms: /\bon\s+netflix\b/i },
  { id: 15, name: "Hulu", terms: /\bon\s+hulu\b/i },
  { id: 337, name: "Disney+", terms: /\bon\s+disney\s*\+?(?:\s+plus)?\b/i },
  { id: 9, name: "Prime Video", terms: /\bon\s+(?:amazon\s+)?prime(?:\s+video)?\b/i },
  { id: 1899, name: "Max", terms: /\bon\s+(?:hbo\s+)?max\b/i },
  { id: 350, name: "Apple TV+", terms: /\bon\s+apple\s*tv\s*\+?(?:\s+plus)?\b/i },
  { id: 386, name: "Peacock", terms: /\bon\s+peacock\b/i },
  { id: 2303, name: "Paramount+", terms: /\bon\s+paramount\s*\+?(?:\s+plus)?\b/i },
];

function parseWatchProvider(query: string): WatchProviderIntent | null {
  const match = WATCH_PROVIDERS.find((provider) => provider.terms.test(query));
  return match ? { id: match.id, name: match.name } : null;
}

export function parseSearchIntent(query: string): SearchIntent {
  const mediaType = TV_WORDS.test(query) ? "tv" : MOVIE_WORDS.test(query) ? "movie" : null;
  const recency = THIS_YEAR_WORDS.test(query) ? "this-year" : RECENT_WORDS.test(query) ? "recent" : null;
  const usePersonalHistory = HISTORY_WORDS.test(query);
  const likeMatch = query.match(LIKE_PATTERN);
  const referencedTitle = likeMatch ? likeMatch[1].split(TRAILING_CONNECTOR)[0].trim() : null;
  const hoursMatch = query.match(UNDER_HOURS_PATTERN);
  const minutesMatch = query.match(UNDER_MINUTES_PATTERN);
  const runtimeUnderMinutes = hoursMatch ? Math.round(Number(hoursMatch[1]) * 60) : minutesMatch ? Number(minutesMatch[1]) : null;
  const excludedGenres = parseExcludedGenres(query);
  const watchProvider = parseWatchProvider(query);

  return { mediaType, recency, referencedTitle, usePersonalHistory, runtimeUnderMinutes, excludedGenres, watchProvider };
}
