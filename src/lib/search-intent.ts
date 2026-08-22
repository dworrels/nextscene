import type { MediaType } from "@/types/tmdb";

export type RecencyIntent = "this-year" | "recent";
export type GenreIntent = { label: string; tmdbName: string; matcher: RegExp };
export type WatchProviderIntent = { id: number; name: string };
export type DateRangeIntent = { start: string; end: string; label: string };
export type LanguageIntent = { code: string; label: string };
export type CountryIntent = { code: string; label: string };
export type TvStatusIntent = { value: string; label: string };
export type PersonIntent = { name: string; role: "director" | "actor" };

export type SearchIntent = {
  mediaType: MediaType | null;
  recency: RecencyIntent | null;
  referencedTitles: string[];
  person: PersonIntent | null;
  usePersonalHistory: boolean;
  runtimeUnderMinutes: number | null;
  includedGenres: GenreIntent[];
  excludedGenres: GenreIntent[];
  watchProvider: WatchProviderIntent | null;
  dateRange: DateRangeIntent | null;
  originalLanguage: LanguageIntent | null;
  originCountry: CountryIntent | null;
  familyFriendly: boolean;
  lowIntensity: boolean;
  tvType: "miniseries" | null;
  tvStatus: TvStatusIntent | null;
  maxSeasons: number | null;
  maxEpisodes: number | null;
};

const TV_WORDS = /\b(?:tv shows?|tv series|television series|series|miniseries|mini[- ]series|limited series)\b/i;
const MOVIE_WORDS = /\b(?:movies?|films?|features?)\b/i;
const THIS_YEAR_WORDS = /\bthis year\b/i;
const RECENT_WORDS = /\brecent(?:ly)?|new(?:est)?|latest\b/i;
const HISTORY_WORDS = /\bmy (?:watch history|ratings|taste)\b|based on (?:what i(?:'ve| have) (?:watched|rated|seen)|my (?:watch history|ratings|taste))/i;
const LIKE_PATTERN = /\b(?:like|similar to|reminds? me of|in the style of|more like)\s+([^.?!]{2,80})/i;
const TRAILING_CONNECTOR = /\b(?:but|except|without|minus|however|that(?:'s| is)|with)\b/i;
const UNDER_HOURS_PATTERN = /\bunder\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i;
const UNDER_MINUTES_PATTERN = /\bunder\s+(\d+)\s*(?:minutes?|mins?|m)\b/i;
const LAST_MONTHS_PATTERN = /\b(?:last|past)\s+(\d{1,2})\s+months?\b/i;
const YEAR_PATTERN = /\b(?:from|released in|in)\s+((?:19|20)\d{2})\b/i;
const DECADE_PATTERN = /\b(?:from\s+)?(?:the\s+)?((?:19|20)\d)0s\b/i;
const SEASONS_PATTERN = /\b(?:under|no more than|at most)\s+(\d+)\s+seasons?\b|\bone[ -]?season\b/i;
const EPISODES_PATTERN = /\b(?:under|no more than|at most)\s+(\d+)\s+episodes?\b/i;
const LIMITED_SERIES_WORDS = /\b(?:limited|mini[- ]?series|miniseries|one[ -]?season)\b/i;
const FAMILY_WORDS = /\b(?:family[- ]friendly|for (?:the )?kids|for children|kid[- ]friendly)\b/i;
const LOW_INTENSITY_WORDS = /\b(?:not too intense|low[- ]intensity|gentle|lighthearted)\b/i;
const DIRECTOR_PATTERN = /\b(?:directed by|by)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){1,3})\b/u;
const ACTOR_PATTERN = /\b(?:starring|with)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){1,3})\b/u;

const GENRES: Array<{ label: string; tmdbName: string; triggerTerm: string; matcher: RegExp }> = [
  { label: "Horror", tmdbName: "Horror", triggerTerm: "horror|scary", matcher: /horror/i },
  { label: "Comedy", tmdbName: "Comedy", triggerTerm: "comed(?:y|ies)|funny", matcher: /comedy/i },
  { label: "Romance", tmdbName: "Romance", triggerTerm: "romance|romantic", matcher: /romance/i },
  { label: "Action", tmdbName: "Action", triggerTerm: "action", matcher: /action/i },
  { label: "Thriller", tmdbName: "Thriller", triggerTerm: "thrillers?|suspense", matcher: /thriller/i },
  { label: "Drama", tmdbName: "Drama", triggerTerm: "dramas?", matcher: /drama/i },
  { label: "Documentary", tmdbName: "Documentary", triggerTerm: "documentar(?:y|ies)|docuseries", matcher: /documentary/i },
  { label: "Animation", tmdbName: "Animation", triggerTerm: "animation|animated|anime", matcher: /animation/i },
  { label: "Sci-Fi", tmdbName: "Science Fiction", triggerTerm: "sci[- ]?fi|science fiction", matcher: /sci-fi|science fiction/i },
  { label: "War", tmdbName: "War", triggerTerm: "war", matcher: /\bwar\b/i },
  { label: "Crime", tmdbName: "Crime", triggerTerm: "crime", matcher: /crime/i },
  { label: "Mystery", tmdbName: "Mystery", triggerTerm: "myster(?:y|ies)|whodunit", matcher: /mystery/i },
  { label: "Western", tmdbName: "Western", triggerTerm: "westerns?", matcher: /western/i },
  { label: "Fantasy", tmdbName: "Fantasy", triggerTerm: "fantasy", matcher: /fantasy/i },
  { label: "Musical", tmdbName: "Music", triggerTerm: "musicals?", matcher: /music/i },
];
const NEGATION_PREFIX = "(?:not|no|non-?|avoid|skip|without|nothing)\\s+(?:a\\s+|an\\s+|any\\s+)?";

const LANGUAGES: Array<LanguageIntent & { terms: RegExp }> = [
  { code: "en", label: "English-language", terms: /\b(?:in )?english(?:[- ]language)?\b/i },
  { code: "es", label: "Spanish-language", terms: /\b(?:in )?spanish(?:[- ]language)?\b/i },
  { code: "fr", label: "French-language", terms: /\b(?:in )?french(?:[- ]language)?\b/i },
  { code: "de", label: "German-language", terms: /\b(?:in )?german(?:[- ]language)?\b/i },
  { code: "it", label: "Italian-language", terms: /\b(?:in )?italian(?:[- ]language)?\b/i },
  { code: "ja", label: "Japanese-language", terms: /\b(?:in )?japanese(?:[- ]language)?\b/i },
  { code: "ko", label: "Korean-language", terms: /\b(?:in )?korean(?:[- ]language)?\b/i },
  { code: "pt", label: "Portuguese-language", terms: /\b(?:in )?portuguese(?:[- ]language)?\b/i },
  { code: "zh", label: "Chinese-language", terms: /\b(?:in )?(?:chinese|mandarin|cantonese)(?:[- ]language)?\b/i },
];

const COUNTRIES: Array<CountryIntent & { terms: RegExp }> = [
  { code: "US", label: "US productions", terms: /\b(?:from the )?(?:us|u\.s\.|united states|american)\b/i },
  { code: "GB", label: "UK productions", terms: /\b(?:from the )?(?:uk|u\.k\.|united kingdom|british)\b/i },
  { code: "KR", label: "South Korean productions", terms: /\b(?:from )?(?:south )?korean?\b/i },
  { code: "JP", label: "Japanese productions", terms: /\b(?:from )?japan(?:ese)?\b/i },
  { code: "FR", label: "French productions", terms: /\b(?:from )?france|french\b/i },
  { code: "IN", label: "Indian productions", terms: /\b(?:from )?india(?:n)?\b/i },
  { code: "ES", label: "Spanish productions", terms: /\b(?:from )?spain|spanish\b/i },
  { code: "MX", label: "Mexican productions", terms: /\b(?:from )?mexico|mexican\b/i },
];

const WATCH_PROVIDERS: Array<{ id: number; name: string; terms: RegExp }> = [
  { id: 8, name: "Netflix", terms: /\b(?:on|with|through)\s+netflix\b/i },
  { id: 15, name: "Hulu", terms: /\b(?:on|with|through)\s+hulu\b/i },
  { id: 337, name: "Disney+", terms: /\b(?:on|with|through)\s+disney\s*\+?(?:\s+plus)?\b/i },
  { id: 9, name: "Prime Video", terms: /\b(?:on|with|through)\s+(?:amazon\s+)?prime(?:\s+video)?\b/i },
  { id: 1899, name: "Max", terms: /\b(?:on|with|through)\s+(?:hbo\s+)?max\b/i },
  { id: 350, name: "Apple TV+", terms: /\b(?:on|with|through)\s+apple\s*tv\s*\+?(?:\s+plus)?\b/i },
  { id: 386, name: "Peacock", terms: /\b(?:on|with|through)\s+peacock\b/i },
  { id: 2303, name: "Paramount+", terms: /\b(?:on|with|through)\s+paramount\s*\+?(?:\s+plus)?\b/i },
  { id: 283, name: "Crunchyroll", terms: /\b(?:on|with|through)\s+crunchyroll\b/i },
  { id: 207, name: "The Roku Channel", terms: /\b(?:on|with|through)\s+(?:the )?roku(?: channel)?\b/i },
  { id: 526, name: "AMC+", terms: /\b(?:on|with|through)\s+amc\s*\+?(?:\s+plus)?\b/i },
  { id: 191, name: "Kanopy", terms: /\b(?:on|with|through)\s+kanopy\b/i },
  { id: 99, name: "Shudder", terms: /\b(?:on|with|through)\s+shudder\b/i },
  { id: 11, name: "MUBI", terms: /\b(?:on|with|through)\s+mubi\b/i },
  { id: 300, name: "Pluto TV", terms: /\b(?:on|with|through)\s+pluto(?:\s+tv)?\b/i },
];

const TV_STATUSES: Array<TvStatusIntent & { terms: RegExp }> = [
  { value: "0", label: "Returning series", terms: /\b(?:returning|ongoing|still airing)\b/i },
  { value: "3", label: "Ended series", terms: /\b(?:finished|ended|complete|completed)\b/i },
  { value: "4", label: "Cancelled series", terms: /\b(?:cancel(?:led|ed))\b/i },
];

function toGenreIntent(genre: typeof GENRES[number]): GenreIntent {
  return { label: genre.label, tmdbName: genre.tmdbName, matcher: genre.matcher };
}

function parseExcludedGenres(query: string): GenreIntent[] {
  return GENRES
    .filter((genre) => new RegExp(`\\b${NEGATION_PREFIX}(?:${genre.triggerTerm})\\b`, "i").test(query))
    .map(toGenreIntent);
}

function parseIncludedGenres(query: string, excludedGenres: GenreIntent[]): GenreIntent[] {
  const excluded = new Set(excludedGenres.map((genre) => genre.label));
  return GENRES.filter((genre) => !excluded.has(genre.label) && new RegExp(`\\b(?:${genre.triggerTerm})\\b`, "i").test(query)).map(toGenreIntent);
}

function parseDateRange(query: string): DateRangeIntent | null {
  const months = query.match(LAST_MONTHS_PATTERN);
  if (months) {
    const count = Number(months[1]);
    if (count >= 1 && count <= 24) {
      const end = new Date();
      const start = new Date(end);
      start.setMonth(start.getMonth() - count);
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: `Last ${count} month${count === 1 ? "" : "s"}` };
    }
  }
  const decade = query.match(DECADE_PATTERN);
  if (decade) {
    const year = Number(`${decade[1]}0`);
    return { start: `${year}-01-01`, end: `${year + 9}-12-31`, label: `${year}s` };
  }
  const year = query.match(YEAR_PATTERN);
  if (year) return { start: `${year[1]}-01-01`, end: `${year[1]}-12-31`, label: year[1] };
  return null;
}

function parseReferencedTitles(query: string): string[] {
  const match = query.match(LIKE_PATTERN);
  if (!match) return [];
  return match[1]
    .split(TRAILING_CONNECTOR)[0]
    .split(/\s+(?:and|or)\s+/i)
    .map((title) => title.trim())
    .filter((title) => title.length >= 2)
    .slice(0, 2);
}

export function parseSearchIntent(query: string): SearchIntent {
  const excludedGenres = parseExcludedGenres(query);
  const includedGenres = parseIncludedGenres(query, excludedGenres);
  const hoursMatch = query.match(UNDER_HOURS_PATTERN);
  const minutesMatch = query.match(UNDER_MINUTES_PATTERN);
  const seasonMatch = query.match(SEASONS_PATTERN);
  const episodeMatch = query.match(EPISODES_PATTERN);
  const mediaType = TV_WORDS.test(query) ? "tv" : MOVIE_WORDS.test(query) ? "movie" : null;
  const lowIntensity = LOW_INTENSITY_WORDS.test(query);
  const tvType = LIMITED_SERIES_WORDS.test(query) || seasonMatch?.[0].toLowerCase().includes("one") ? "miniseries" : null;
  const lowIntensityExclusions = GENRES.filter((genre) => genre.label === "Horror" || genre.label === "Thriller").map(toGenreIntent);
  const provider = WATCH_PROVIDERS.find((entry) => entry.terms.test(query));
  const language = LANGUAGES.find((entry) => entry.terms.test(query));
  const country = COUNTRIES.find((entry) => entry.terms.test(query));
  const status = TV_STATUSES.find((entry) => entry.terms.test(query));
  const director = query.match(DIRECTOR_PATTERN)?.[1];
  const actor = query.match(ACTOR_PATTERN)?.[1];

  return {
    mediaType,
    recency: THIS_YEAR_WORDS.test(query) ? "this-year" : RECENT_WORDS.test(query) ? "recent" : null,
    referencedTitles: parseReferencedTitles(query),
    person: director ? { name: director, role: "director" } : actor ? { name: actor, role: "actor" } : null,
    usePersonalHistory: HISTORY_WORDS.test(query),
    runtimeUnderMinutes: hoursMatch ? Math.round(Number(hoursMatch[1]) * 60) : minutesMatch ? Number(minutesMatch[1]) : null,
    includedGenres,
    excludedGenres: lowIntensity ? [...excludedGenres, ...lowIntensityExclusions.filter((genre) => !excludedGenres.some((existing) => existing.label === genre.label))] : excludedGenres,
    watchProvider: provider ? { id: provider.id, name: provider.name } : null,
    dateRange: parseDateRange(query),
    originalLanguage: language ? { code: language.code, label: language.label } : null,
    originCountry: country ? { code: country.code, label: country.label } : null,
    familyFriendly: FAMILY_WORDS.test(query),
    lowIntensity,
    tvType,
    tvStatus: status ? { value: status.value, label: status.label } : null,
    maxSeasons: seasonMatch ? (seasonMatch[1] ? Number(seasonMatch[1]) : 1) : null,
    maxEpisodes: episodeMatch ? Number(episodeMatch[1]) : null,
  };
}
