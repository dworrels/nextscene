import type {
  CastMember,
  Catalog,
  Episode,
  EpisodeDetail,
  MediaType,
  Movie,
  MovieDetail,
  SeasonDetail,
  SeasonSummary,
  TvShow,
  TvShowDetail,
  UpcomingMovie,
  WatchProvider,
  WatchProviders,
} from "@/types/tmdb";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prioritizeMediaItems, readContentPreferences } from "@/lib/content-preferences";

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  vote_average: number;
  original_language?: string;
  origin_country?: string[];
};

type TmdbPagedResponse<T> = {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
};
type TmdbListResponse = TmdbPagedResponse<TmdbMovie>;
type TmdbGenresResponse = { genres: Array<{ id: number; name: string }> };
type TmdbConfiguration = {
  images: {
    secure_base_url: string;
    poster_sizes: string[];
    backdrop_sizes: string[];
    profile_sizes: string[];
    logo_sizes: string[];
    still_sizes: string[];
  };
};

type TmdbVideo = { key: string; site: string; type: string; official: boolean };
type TmdbCastCredit = { id: number; name: string; character: string; profile_path: string | null };
type TmdbCrewCredit = { id: number; name: string; job: string; department: string };
type TmdbReleaseDate = { certification: string; type: number; release_date: string };
type TmdbReleaseDatesCountry = { iso_3166_1: string; release_dates: TmdbReleaseDate[] };
type TmdbReleaseDatesResponse = { results: TmdbReleaseDatesCountry[] };
type TmdbWatchProviderEntry = { provider_id: number; provider_name: string; logo_path: string | null };
type TmdbWatchProvidersRegion = { link?: string; flatrate?: TmdbWatchProviderEntry[]; rent?: TmdbWatchProviderEntry[]; buy?: TmdbWatchProviderEntry[] };
type TmdbWatchProvidersResponse = { results: Record<string, TmdbWatchProvidersRegion> };

type TmdbMovieDetail = TmdbMovie & {
  runtime: number | null;
  tagline: string;
  genres: Array<{ id: number; name: string }>;
  videos: { results: TmdbVideo[] };
  credits: { cast: TmdbCastCredit[]; crew: TmdbCrewCredit[] };
  recommendations: TmdbListResponse;
  release_dates: TmdbReleaseDatesResponse;
  external_ids: { imdb_id: string | null };
  "watch/providers": TmdbWatchProvidersResponse;
  keywords: { keywords: Array<{ id: number; name: string }> };
  production_countries: Array<{ iso_3166_1: string; name: string }>;
};
type TmdbMovieProfile = TmdbMovie & {
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  credits: { cast: TmdbCastCredit[]; crew: TmdbCrewCredit[] };
  keywords: { keywords: Array<{ id: number; name: string }> };
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  release_dates: TmdbReleaseDatesResponse;
};

type TmdbTv = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  vote_average: number;
  original_language?: string;
  origin_country?: string[];
};

type TmdbTvListResponse = TmdbPagedResponse<TmdbTv>;
type TmdbCreator = { id: number; name: string };
type TmdbNetwork = { id: number; name: string };
type TmdbSeason = {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
};
type TmdbContentRating = { iso_3166_1: string; rating: string };
type TmdbContentRatingsResponse = { results: TmdbContentRating[] };

type TmdbTvDetail = TmdbTv & {
  tagline: string;
  genres: Array<{ id: number; name: string }>;
  videos: { results: TmdbVideo[] };
  credits: { cast: TmdbCastCredit[]; crew: TmdbCrewCredit[] };
  recommendations: TmdbTvListResponse;
  content_ratings: TmdbContentRatingsResponse;
  external_ids: { imdb_id: string | null };
  "watch/providers": TmdbWatchProvidersResponse;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  created_by: TmdbCreator[];
  networks: TmdbNetwork[];
  seasons: TmdbSeason[];
  keywords: { results: Array<{ id: number; name: string }> };
};
type TmdbTvProfile = TmdbTv & {
  genres: Array<{ id: number; name: string }>;
  credits: { cast: TmdbCastCredit[]; crew: TmdbCrewCredit[] };
  keywords: { results: Array<{ id: number; name: string }> };
  episode_run_time: number[];
  created_by: TmdbCreator[];
  networks: TmdbNetwork[];
  content_ratings: TmdbContentRatingsResponse;
  number_of_seasons: number;
  number_of_episodes: number;
};

type TmdbEpisode = {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
};

type TmdbSeasonDetail = {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbEpisode[];
};

type TmdbEpisodeDetail = TmdbEpisode & {
  crew: TmdbCrewCredit[];
  guest_stars: TmdbCastCredit[];
};

const REVALIDATE_SECONDS = 60 * 60;
const DEFAULT_REGION = "US";
const TMDB_KEYWORD_LIMIT = 20;
const RELEASE_TYPE_LABELS: Record<number, string> = {
  1: "Premiere",
  2: "Limited Theatrical",
  3: "Theatrical",
  4: "Digital",
  5: "Physical",
  6: "TV",
};

function collectKeywords(keywords: Array<{ name: string }>): string[] {
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const keyword of keywords) {
    const name = keyword.name.normalize("NFKC").trim().replace(/\s+/g, " ");
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    collected.push(name);
    if (collected.length === TMDB_KEYWORD_LIMIT) break;
  }

  return collected;
}

export class TmdbError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

export function isTmdbNotFound(error: unknown): boolean {
  return error instanceof TmdbError && error.status === 404;
}

function getConfig() {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN is not configured.");

  return {
    token,
    baseUrl: process.env.TMDB_API_BASE_URL || "https://api.themoviedb.org/3",
    language: process.env.TMDB_DEFAULT_LANGUAGE || "en-US",
  };
}

async function requestTmdbFromApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { token, baseUrl, language } = getConfig();
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path}`);
  url.searchParams.set("language", language);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) throw new TmdbError(response.status, `TMDb request failed with status ${response.status}.`);
  return response.json() as Promise<T>;
}

// TMDb configuration, genres, and catalogue responses are shared across the
// whole site. The fetch cache already provides revalidation; this additional
// cache also deduplicates identical server work across dynamic routes.
const getCachedTmdbResponse = unstable_cache(
  async (path: string, params: Record<string, string>) => requestTmdbFromApi<unknown>(path, params),
  ["tmdb-response-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: ["tmdb"] },
);

async function requestTmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  return getCachedTmdbResponse(path, params) as Promise<T>;
}

function imageUrl(baseUrl: string, sizes: string[], preferredSize: string, path: string | null) {
  if (!path) return null;
  const size = sizes.includes(preferredSize) ? preferredSize : sizes.at(-1);
  return size ? `${baseUrl}${size}${path}` : null;
}

function toMovie(
  movie: TmdbMovie,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
): Movie {
  const posterUrl = imageUrl(configuration.images.secure_base_url, configuration.images.poster_sizes, "w500", movie.poster_path);
  const backdropUrl = imageUrl(configuration.images.secure_base_url, configuration.images.backdrop_sizes, "w1280", movie.backdrop_path);

  const genreNames = movie.genre_ids.map((id) => genres.get(id)).filter((name): name is string => Boolean(name));
  return {
    id: movie.id,
    mediaType: "movie",
    title: movie.title,
    overview: movie.overview,
    releaseDate: movie.release_date,
    year: movie.release_date?.slice(0, 4) || "—",
    posterUrl,
    backdropUrl,
    genre: genreNames[0] || "Film",
    genres: genreNames,
    audienceScore: Math.round(movie.vote_average * 10),
    originalLanguageCode: movie.original_language ?? null,
    originCountryCodes: movie.origin_country ?? [],
  };
}

function mapMovies(
  response: TmdbListResponse,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
) {
  return response.results
    .map((movie) => toMovie(movie, configuration, genres));
}

function toPagedResult<T>(response: TmdbPagedResponse<unknown>, items: T[]) {
  return {
    items,
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
  };
}

function toTvShow(
  tv: TmdbTv,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
): TvShow {
  const posterUrl = imageUrl(configuration.images.secure_base_url, configuration.images.poster_sizes, "w500", tv.poster_path);
  const backdropUrl = imageUrl(configuration.images.secure_base_url, configuration.images.backdrop_sizes, "w1280", tv.backdrop_path);

  const genreNames = tv.genre_ids.map((id) => genres.get(id)).filter((name): name is string => Boolean(name));
  return {
    id: tv.id,
    mediaType: "tv",
    title: tv.name,
    overview: tv.overview,
    releaseDate: tv.first_air_date,
    year: tv.first_air_date?.slice(0, 4) || "—",
    posterUrl,
    backdropUrl,
    genre: genreNames[0] || "Series",
    genres: genreNames,
    audienceScore: Math.round(tv.vote_average * 10),
    originalLanguageCode: tv.original_language ?? null,
    originCountryCodes: tv.origin_country ?? [],
  };
}

function mapTvShows(
  response: TmdbTvListResponse,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
) {
  return response.results
    .map((tv) => toTvShow(tv, configuration, genres));
}

function pickTvCertification(ratings: TmdbContentRatingsResponse): string | null {
  return ratings.results.find((entry) => entry.iso_3166_1 === DEFAULT_REGION)?.rating || null;
}

function toSeasonSummary(season: TmdbSeason, baseUrl: string, posterSizes: string[]): SeasonSummary {
  return {
    id: season.id,
    seasonNumber: season.season_number,
    name: season.name,
    overview: season.overview,
    posterUrl: imageUrl(baseUrl, posterSizes, "w342", season.poster_path),
    airDate: season.air_date,
    episodeCount: season.episode_count,
  };
}

function toEpisode(episode: TmdbEpisode, baseUrl: string, stillSizes: string[]): Episode {
  return {
    id: episode.id,
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    name: episode.name,
    overview: episode.overview,
    stillUrl: imageUrl(baseUrl, stillSizes, "w300", episode.still_path),
    airDate: episode.air_date,
    runtime: episode.runtime,
    audienceScore: Math.round(episode.vote_average * 10),
  };
}

function usReleaseEntries(releaseDates: TmdbReleaseDatesResponse): TmdbReleaseDate[] {
  return releaseDates.results.find((country) => country.iso_3166_1 === DEFAULT_REGION)?.release_dates ?? [];
}

function pickCertification(entries: TmdbReleaseDate[]): string | null {
  return entries.find((entry) => entry.certification)?.certification || null;
}

function pickTrailerKey(videos: { results: TmdbVideo[] }): string | null {
  const trailers = videos.results.filter((video) => video.site === "YouTube" && video.type === "Trailer");
  return (trailers.find((video) => video.official) ?? trailers[0])?.key ?? null;
}

function pickDirector(credits: { crew: TmdbCrewCredit[] }): string | null {
  return credits.crew.find((member) => member.department === "Directing" && member.job === "Director")?.name ?? null;
}

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageName(code: string | undefined): string | null {
  if (!code) return null;
  try {
    return LANGUAGE_NAMES.of(code) ?? null;
  } catch {
    return null;
  }
}

function toCast(cast: TmdbCastCredit[], baseUrl: string, profileSizes: string[]): CastMember[] {
  return cast.slice(0, 8).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profileUrl: imageUrl(baseUrl, profileSizes, "w185", member.profile_path),
  }));
}

function toProviderList(entries: TmdbWatchProviderEntry[] | undefined, baseUrl: string, logoSizes: string[]): WatchProvider[] {
  if (!entries) return [];
  return entries.map((entry) => ({
    id: entry.provider_id,
    name: entry.provider_name,
    logoUrl: imageUrl(baseUrl, logoSizes, "w92", entry.logo_path),
  }));
}

function toWatchProviders(response: TmdbWatchProvidersResponse, baseUrl: string, logoSizes: string[]): WatchProviders {
  const region = response.results[DEFAULT_REGION];
  if (!region) return { link: null, flatrate: [], rent: [], buy: [] };

  return {
    link: region.link ?? null,
    flatrate: toProviderList(region.flatrate, baseUrl, logoSizes),
    rent: toProviderList(region.rent, baseUrl, logoSizes),
    buy: toProviderList(region.buy, baseUrl, logoSizes),
  };
}

export type HomeMovieCatalog = Pick<Catalog, "featured" | "recommendations">;

export const getHomeMovieCatalog = cache(async function getHomeMovieCatalog(): Promise<HomeMovieCatalog> {
  const [configuration, genreResponse, nowPlaying, popular, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("movie/now_playing", { page: "1" }),
    requestTmdb<TmdbListResponse>("movie/popular", { page: "1" }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const nowPlayingMovies = prioritizeMediaItems(mapMovies(nowPlaying, configuration, genres), preferences);
  const popularMovies = prioritizeMediaItems(mapMovies(popular, configuration, genres), preferences);
  const featured = nowPlayingMovies.find((movie) => movie.backdropUrl) || popularMovies.find((movie) => movie.backdropUrl);

  if (!featured) throw new Error("TMDb returned no movies with usable artwork.");

  return {
    featured,
    recommendations: popularMovies.filter((movie) => movie.id !== featured.id),
  };
});

export async function getUpcomingMovieReleases(): Promise<UpcomingMovie[]> {
  const [configuration, genreResponse, upcoming, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("movie/upcoming", { page: "1", region: DEFAULT_REGION }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const today = new Date().toISOString().slice(0, 10);
  const upcomingMovies = prioritizeMediaItems(mapMovies(upcoming, configuration, genres), preferences)
    .filter((movie) => !movie.releaseDate || movie.releaseDate > today)
    .slice(0, 8);

  const releaseDatesList = await Promise.all(
    upcomingMovies.map((movie) => requestTmdb<TmdbReleaseDatesResponse>(`movie/${movie.id}/release_dates`)),
  );
  const releases: UpcomingMovie[] = upcomingMovies.map((movie, index) => ({
    ...movie,
    certification: pickCertification(usReleaseEntries(releaseDatesList[index])),
  }));

  return releases;
}

export async function getMovieCatalog(): Promise<Catalog> {
  const [catalog, releases] = await Promise.all([getHomeMovieCatalog(), getUpcomingMovieReleases()]);
  return { ...catalog, releases };
}

async function listMovies(path: string, page: number, params: Record<string, string> = {}) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>(path, { page: String(page), ...params }),
    readContentPreferences(),
  ]);
  return toPagedResult(response, prioritizeMediaItems(mapMovies(response, configuration, new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]))), preferences));
}

export async function getPopularMovies(page = 1) {
  return listMovies("movie/popular", page);
}

export async function getTopRatedMovies(page = 1) {
  return listMovies("movie/top_rated", page);
}

export async function getNowPlayingMovies(page = 1) {
  return listMovies("movie/now_playing", page);
}

export async function getUpcomingMovies(page = 1) {
  const result = await listMovies("movie/upcoming", page, { region: DEFAULT_REGION });
  const today = new Date().toISOString().slice(0, 10);
  return { ...result, items: result.items.filter((movie) => !movie.releaseDate || movie.releaseDate > today) };
}

export async function getSearchMovies(query: string, page = 1) {
  const [configuration, genreResponse, search, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("search/movie", { query, page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(search, prioritizeMediaItems(mapMovies(search, configuration, genres), preferences));
}

export async function findMovieByImdbId(imdbId: string): Promise<number | null> {
  const response = await requestTmdb<{ movie_results: TmdbMovie[] }>(`find/${imdbId}`, { external_source: "imdb_id" });
  return response.movie_results[0]?.id ?? null;
}

export async function searchMovieId(query: string): Promise<number | null> {
  const response = await requestTmdb<{ results: Array<{ id: number }> }>("search/movie", { query });
  return response.results[0]?.id ?? null;
}

export async function getMovieDetails(id: number): Promise<MovieDetail> {
  const [configuration, genreResponse, detail, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbMovieDetail>(`movie/${id}`, {
      append_to_response: "videos,credits,keywords,recommendations,release_dates,external_ids,watch/providers",
    }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const movie = toMovie({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);

  const { secure_base_url, profile_sizes, logo_sizes } = configuration.images;
  const usEntries = usReleaseEntries(detail.release_dates);
  const certification = pickCertification(usEntries);
  const director = pickDirector(detail.credits);

  return {
    ...movie,
    runtimeMinutes: detail.runtime,
    people: [director, ...detail.credits.cast.slice(0, 5).map((member) => member.name)].filter((name): name is string => Boolean(name)),
    keywords: collectKeywords(detail.keywords.keywords),
    originCountryCodes: detail.production_countries.map((country) => country.iso_3166_1),
    certificationCode: certification,
    runtime: detail.runtime,
    tagline: detail.tagline,
    genres: detail.genres.map((genre) => genre.name),
    certification,
    imdbId: detail.external_ids.imdb_id,
    trailerKey: pickTrailerKey(detail.videos),
    director,
    originalLanguage: languageName(detail.original_language),
    cast: toCast(detail.credits.cast, secure_base_url, profile_sizes),
    recommendations: prioritizeMediaItems(mapMovies(detail.recommendations, configuration, genres), preferences),
    // TMDb's release_dates.release_date is a full ISO timestamp
    // ("2010-11-26T00:00:00.000Z"), unlike the plain "YYYY-MM-DD" used
    // elsewhere (e.g. movie.releaseDate) — normalize to that same plain
    // form so downstream date formatting works consistently either way.
    releaseTimeline: usEntries
      .map((entry) => ({ type: RELEASE_TYPE_LABELS[entry.type] ?? "Release", date: entry.release_date.slice(0, 10) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    watchProviders: toWatchProviders(detail["watch/providers"], secure_base_url, logo_sizes),
  };
}

export async function getMovieTitle(id: number): Promise<string> {
  const detail = await requestTmdb<{ title: string }>(`movie/${id}`);
  return detail.title;
}

export async function getMovieRecommendations(id: number, page = 1) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>(`movie/${id}/recommendations`, { page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapMovies(response, configuration, genres), preferences));
}

async function listTvShows(path: string, page: number) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>(path, { page: String(page) }),
    readContentPreferences(),
  ]);
  return toPagedResult(response, prioritizeMediaItems(mapTvShows(response, configuration, new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]))), preferences));
}

export async function getPopularTvShows(page = 1) {
  return listTvShows("tv/popular", page);
}

export async function getTopRatedTvShows(page = 1) {
  return listTvShows("tv/top_rated", page);
}

export async function getOnTheAirTvShows(page = 1) {
  return listTvShows("tv/on_the_air", page);
}

export async function getAiringTodayTvShows(page = 1) {
  return listTvShows("tv/airing_today", page);
}

export async function getSearchTv(query: string, page = 1) {
  const [configuration, genreResponse, search, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>("search/tv", { query, page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(search, prioritizeMediaItems(mapTvShows(search, configuration, genres), preferences));
}

export async function findTvByImdbId(imdbId: string): Promise<number | null> {
  const response = await requestTmdb<{ tv_results: TmdbTv[] }>(`find/${imdbId}`, { external_source: "imdb_id" });
  return response.tv_results[0]?.id ?? null;
}

// IMDb identifies individual episodes separately from their series. A
// watchlist needs the series-level TMDb ID so it can link to and recommend the
// show, rather than attempting to treat an episode as a standalone title.
export async function findTvParentByEpisodeImdbId(imdbId: string): Promise<number | null> {
  const response = await requestTmdb<{ tv_episode_results?: Array<{ show_id?: number }> }>(`find/${imdbId}`, { external_source: "imdb_id" });
  return response.tv_episode_results?.[0]?.show_id ?? null;
}

export async function searchTvId(query: string): Promise<number | null> {
  const response = await requestTmdb<{ results: Array<{ id: number }> }>("search/tv", { query });
  return response.results[0]?.id ?? null;
}

export async function getTvDetails(id: number): Promise<TvShowDetail> {
  const [configuration, genreResponse, detail, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvDetail>(`tv/${id}`, {
      append_to_response: "videos,credits,keywords,recommendations,content_ratings,external_ids,watch/providers",
    }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const tv = toTvShow({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);

  const { secure_base_url, profile_sizes, logo_sizes, poster_sizes } = configuration.images;
  const certification = pickTvCertification(detail.content_ratings);
  const creators = detail.created_by.map((creator) => creator.name);
  const networkNames = detail.networks.map((network) => network.name);
  const episodeRuntime = detail.episode_run_time[0] ?? null;

  return {
    ...tv,
    runtimeMinutes: episodeRuntime,
    people: [...creators, ...detail.credits.cast.slice(0, 5).map((member) => member.name)],
    keywords: collectKeywords(detail.keywords.results),
    networkNames,
    certificationCode: certification,
    seasonCount: detail.number_of_seasons,
    episodeCount: detail.number_of_episodes,
    tagline: detail.tagline,
    genres: detail.genres.map((genre) => genre.name),
    certification,
    imdbId: detail.external_ids.imdb_id,
    trailerKey: pickTrailerKey(detail.videos),
    creators,
    originalLanguage: languageName(detail.original_language),
    cast: toCast(detail.credits.cast, secure_base_url, profile_sizes),
    recommendations: prioritizeMediaItems(mapTvShows(detail.recommendations, configuration, genres), preferences),
    numberOfSeasons: detail.number_of_seasons,
    numberOfEpisodes: detail.number_of_episodes,
    episodeRuntime,
    status: detail.status,
    networks: networkNames,
    seasons: detail.seasons
      .filter((season) => season.season_number > 0)
      .map((season) => toSeasonSummary(season, secure_base_url, poster_sizes)),
    watchProviders: toWatchProviders(detail["watch/providers"], secure_base_url, logo_sizes),
  };
}

export async function getTvRecommendations(id: number, page = 1) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>(`tv/${id}/recommendations`, { page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapTvShows(response, configuration, genres), preferences));
}

export async function getTvShowName(id: number): Promise<string> {
  const detail = await requestTmdb<{ name: string }>(`tv/${id}`);
  return detail.name;
}

// The bare detail endpoint returns full {id, name} genre objects (unlike list
// responses, which only carry genre_ids) — cheap way to get a genre id to feed
// into discover's with_genres param without a second lookup against the genre list.
export async function getPrimaryGenre(id: number, mediaType: MediaType): Promise<{ id: number; name: string } | null> {
  const path = mediaType === "tv" ? `tv/${id}` : `movie/${id}`;
  const detail = await requestTmdb<{ genres: Array<{ id: number; name: string }> }>(path);
  return detail.genres[0] ?? null;
}

export async function discoverMoviesByGenre(genreId: number, page = 1) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("discover/movie", {
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_count.gte": "200",
      page: String(page),
    }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapMovies(response, configuration, genres), preferences));
}

export async function discoverTvByGenre(genreId: number, page = 1) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>("discover/tv", {
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_count.gte": "200",
      page: String(page),
    }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapTvShows(response, configuration, genres), preferences));
}

// Translates a personal model's top-weighted feature groups (see
// getTopWeightedFeatures in personal-model.ts) into a TMDb /discover query, so
// "what to watch" candidates can be sourced from the taste the model has
// actually learned rather than only TMDb's generic per-title recommendations.
export type DiscoverFeature = { group: string; value: string };

const RUNTIME_BUCKET_MINUTES: Record<string, [number, number]> = {
  short: [0, 45],
  standard: [46, 105],
  long: [106, 140],
  "very-long": [141, 400],
};

async function resolveGenreId(name: string, mediaType: MediaType): Promise<number | null> {
  const response = await requestTmdb<TmdbGenresResponse>(mediaType === "tv" ? "genre/tv/list" : "genre/movie/list");
  return response.genres.find((genre) => genre.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}

async function resolveKeywordId(name: string): Promise<number | null> {
  const response = await requestTmdb<{ results: Array<{ id: number; name: string }> }>("search/keyword", { query: name });
  return response.results[0]?.id ?? null;
}

async function resolvePersonId(name: string): Promise<number | null> {
  const response = await requestTmdb<{ results: Array<{ id: number }> }>("search/person", { query: name });
  return response.results[0]?.id ?? null;
}

// Same group builds an OR (comma-separated values would AND in TMDb's API, so
// pipe-join instead); different groups AND together as separate params, which
// is what keeps the query shaped like "this genre AND this decade" rather
// than a single broad filter.
async function buildDiscoverParams(features: DiscoverFeature[], mediaType: MediaType): Promise<Record<string, string>> {
  const params: Record<string, string> = { sort_by: "popularity.desc", "vote_count.gte": "50" };
  const genreIds: number[] = [];
  const keywordIds: number[] = [];
  const personIds: number[] = [];

  await Promise.all(features.map(async (feature) => {
    if (feature.group === "genre") {
      const id = await resolveGenreId(feature.value, mediaType);
      if (id) genreIds.push(id);
    } else if (feature.group === "keyword") {
      const id = await resolveKeywordId(feature.value);
      if (id) keywordIds.push(id);
    } else if (feature.group === "person") {
      const id = await resolvePersonId(feature.value);
      if (id) personIds.push(id);
    } else if (feature.group === "decade") {
      const decade = Number(feature.value);
      if (Number.isInteger(decade)) {
        const [gteKey, lteKey] = mediaType === "tv" ? ["first_air_date.gte", "first_air_date.lte"] : ["primary_release_date.gte", "primary_release_date.lte"];
        params[gteKey] = `${decade}-01-01`;
        params[lteKey] = `${decade + 9}-12-31`;
      }
    } else if (feature.group === "language") {
      params.with_original_language = feature.value;
    } else if (feature.group === "runtime") {
      const bucket = RUNTIME_BUCKET_MINUTES[feature.value];
      if (bucket) {
        params["with_runtime.gte"] = String(bucket[0]);
        params["with_runtime.lte"] = String(bucket[1]);
      }
    } else if (feature.group === "certification") {
      params.certification_country = DEFAULT_REGION;
      params.certification = feature.value.toUpperCase();
    } else if (feature.group === "country") {
      params.with_origin_country = feature.value.toUpperCase();
    }
  }));

  if (genreIds.length > 0) params.with_genres = genreIds.join("|");
  if (keywordIds.length > 0) params.with_keywords = keywordIds.join("|");
  if (personIds.length > 0) params.with_people = personIds.join("|");
  return params;
}

// TMDb's `with_runtime.lte` discover param is honored for movies but not TV
// (verified empirically — /discover/tv returns the same results with or
// without it, since a series doesn't have one single runtime), so a runtime
// constraint can only be applied accurately to movies.
export async function discoverMoviesUnderRuntime(maxMinutes: number, page = 1) {
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("discover/movie", { sort_by: "popularity.desc", "vote_count.gte": "50", "with_runtime.lte": String(maxMinutes), page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapMovies(response, configuration, genres), preferences));
}

export async function discoverMoviesByFeatures(features: DiscoverFeature[], page = 1) {
  const discoverParams = await buildDiscoverParams(features, "movie");
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("discover/movie", { ...discoverParams, page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapMovies(response, configuration, genres), preferences));
}

export async function discoverTvByFeatures(features: DiscoverFeature[], page = 1) {
  const discoverParams = await buildDiscoverParams(features, "tv");
  const [configuration, genreResponse, response, preferences] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>("discover/tv", { ...discoverParams, page: String(page) }),
    readContentPreferences(),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, prioritizeMediaItems(mapTvShows(response, configuration, genres), preferences));
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Profile lookup for already-known ids. Credits and keywords are fetched with
// each cached TMDb detail so the personal model can learn more than broad genre
// similarity without requiring separate requests for every metadata category.
export async function getMediaCards(refs: Array<{ id: number; mediaType: MediaType }>): Promise<Map<string, Movie | TvShow>> {
  const configuration = await requestTmdb<TmdbConfiguration>("configuration");

  const items = await mapWithConcurrency(refs, 8, async (ref) => {
    if (ref.mediaType === "tv") {
      const detail = await requestTmdb<TmdbTvProfile>(`tv/${ref.id}`, { append_to_response: "credits,keywords,content_ratings" }).catch(() => null);
      if (!detail) return null;
      const genres = new Map(detail.genres.map((genre) => [genre.id, genre.name]));
      const item = toTvShow({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);
      return {
        ...item,
        runtimeMinutes: detail.episode_run_time[0] ?? null,
        people: [...detail.created_by.map((creator) => creator.name), ...detail.credits.cast.slice(0, 5).map((member) => member.name)],
        keywords: collectKeywords(detail.keywords.results),
        networkNames: detail.networks.map((network) => network.name),
        certificationCode: pickTvCertification(detail.content_ratings),
        seasonCount: detail.number_of_seasons,
        episodeCount: detail.number_of_episodes,
      };
    }
    const detail = await requestTmdb<TmdbMovieProfile>(`movie/${ref.id}`, { append_to_response: "credits,keywords,release_dates" }).catch(() => null);
    if (!detail) return null;
    const genres = new Map(detail.genres.map((genre) => [genre.id, genre.name]));
    const item = toMovie({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);
    const director = pickDirector(detail.credits);
    return {
      ...item,
      runtimeMinutes: detail.runtime,
      people: [director, ...detail.credits.cast.slice(0, 5).map((member) => member.name)].filter((name): name is string => Boolean(name)),
      keywords: collectKeywords(detail.keywords.keywords),
      originCountryCodes: detail.production_countries.map((country) => country.iso_3166_1),
      certificationCode: pickCertification(usReleaseEntries(detail.release_dates)),
    };
  });

  const cards = new Map<string, Movie | TvShow>();
  refs.forEach((ref, index) => {
    const item = items[index];
    if (item) cards.set(`${ref.mediaType}-${ref.id}`, item);
  });
  return cards;
}

export async function getSeasonDetails(showId: number, seasonNumber: number): Promise<SeasonDetail> {
  const [configuration, showName, detail] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    getTvShowName(showId),
    requestTmdb<TmdbSeasonDetail>(`tv/${showId}/season/${seasonNumber}`),
  ]);
  const { secure_base_url, poster_sizes, still_sizes } = configuration.images;

  return {
    showId,
    showName,
    seasonNumber: detail.season_number,
    name: detail.name,
    overview: detail.overview,
    posterUrl: imageUrl(secure_base_url, poster_sizes, "w342", detail.poster_path),
    airDate: detail.air_date,
    episodes: detail.episodes.map((episode) => toEpisode(episode, secure_base_url, still_sizes)),
  };
}

export async function getEpisodeDetails(showId: number, seasonNumber: number, episodeNumber: number): Promise<EpisodeDetail> {
  const [configuration, showName, detail] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    getTvShowName(showId),
    requestTmdb<TmdbEpisodeDetail>(`tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`),
  ]);
  const { secure_base_url, still_sizes, profile_sizes } = configuration.images;

  return {
    ...toEpisode(detail, secure_base_url, still_sizes),
    showId,
    showName,
    crew: detail.crew.map((member) => ({ id: member.id, name: member.name, job: member.job })),
    guestStars: toCast(detail.guest_stars, secure_base_url, profile_sizes),
  };
}
