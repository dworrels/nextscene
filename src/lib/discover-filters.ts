export type DiscoverFilters = {
  query?: string;
  genre?: number;
  decade?: number;
  runtimeMin?: number;
  runtimeMax?: number;
  language?: string;
  certification?: string;
  sortBy: string;
  person?: string;
  personRole: "cast" | "crew";
  providers: number[];
  page: number;
};

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

function str(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function int(value: SearchParamValue): number | undefined {
  const parsed = str(value);
  const num = parsed ? Number(parsed) : NaN;
  return Number.isFinite(num) ? num : undefined;
}

export function parseDiscoverFilters(searchParams: SearchParams): DiscoverFilters {
  const providersParam = searchParams.providers;
  const providers = (Array.isArray(providersParam) ? providersParam : providersParam ? [providersParam] : [])
    .map(Number)
    .filter(Number.isFinite);

  return {
    query: str(searchParams.q)?.trim() || undefined,
    genre: int(searchParams.genre),
    decade: int(searchParams.decade),
    runtimeMin: int(searchParams.runtimeMin),
    runtimeMax: int(searchParams.runtimeMax),
    language: str(searchParams.language) || undefined,
    certification: str(searchParams.certification) || undefined,
    sortBy: str(searchParams.sortBy) || "popularity.desc",
    person: str(searchParams.person)?.trim() || undefined,
    personRole: str(searchParams.personRole) === "crew" ? "crew" : "cast",
    providers,
    page: int(searchParams.page) || 1,
  };
}

const DEFAULT_REGION = "US";
const MIN_VOTE_COUNT = 50;

export function buildDiscoverParams(filters: DiscoverFilters, resolvedPersonId?: number | null): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: filters.sortBy,
    page: String(filters.page),
    include_adult: "false",
    "vote_count.gte": String(MIN_VOTE_COUNT),
  };

  if (filters.genre) params.with_genres = String(filters.genre);
  if (filters.decade) {
    params["primary_release_date.gte"] = `${filters.decade}-01-01`;
    params["primary_release_date.lte"] = `${filters.decade + 9}-12-31`;
  }
  if (filters.runtimeMin) params["with_runtime.gte"] = String(filters.runtimeMin);
  if (filters.runtimeMax) params["with_runtime.lte"] = String(filters.runtimeMax);
  if (filters.language) params.with_original_language = filters.language;
  if (filters.certification) {
    params.certification = filters.certification;
    params.certification_country = DEFAULT_REGION;
  }
  if (filters.providers.length > 0) {
    params.with_watch_providers = filters.providers.join("|");
    params.watch_region = DEFAULT_REGION;
  }
  if (resolvedPersonId) {
    if (filters.personRole === "crew") params.with_crew = String(resolvedPersonId);
    else params.with_cast = String(resolvedPersonId);
  }

  return params;
}

export function countActiveFilters(filters: DiscoverFilters): number {
  return [
    filters.genre,
    filters.decade,
    filters.runtimeMin,
    filters.runtimeMax,
    filters.language,
    filters.certification,
    filters.person,
    filters.sortBy !== "popularity.desc" ? filters.sortBy : undefined,
    filters.providers.length > 0 ? filters.providers : undefined,
  ].filter((value) => value !== undefined).length;
}
