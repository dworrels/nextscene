import type { MediaType } from "@/types/tmdb";

export type RecencyIntent = "this-year" | "recent";

export type SearchIntent = {
  mediaType: MediaType | null;
  recency: RecencyIntent | null;
  referencedTitle: string | null;
  usePersonalHistory: boolean;
  runtimeUnderMinutes: number | null;
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

export function parseSearchIntent(query: string): SearchIntent {
  const mediaType = TV_WORDS.test(query) ? "tv" : MOVIE_WORDS.test(query) ? "movie" : null;
  const recency = THIS_YEAR_WORDS.test(query) ? "this-year" : RECENT_WORDS.test(query) ? "recent" : null;
  const usePersonalHistory = HISTORY_WORDS.test(query);
  const likeMatch = query.match(LIKE_PATTERN);
  const referencedTitle = likeMatch ? likeMatch[1].split(TRAILING_CONNECTOR)[0].trim() : null;
  const hoursMatch = query.match(UNDER_HOURS_PATTERN);
  const minutesMatch = query.match(UNDER_MINUTES_PATTERN);
  const runtimeUnderMinutes = hoursMatch ? Math.round(Number(hoursMatch[1]) * 60) : minutesMatch ? Number(minutesMatch[1]) : null;

  return { mediaType, recency, referencedTitle, usePersonalHistory, runtimeUnderMinutes };
}
