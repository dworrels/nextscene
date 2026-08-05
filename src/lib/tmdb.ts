import type {
  CastMember,
  Catalog,
  Movie,
  MovieDetail,
  UpcomingMovie,
  WatchProvider,
  WatchProviders,
} from "@/types/tmdb";

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  vote_average: number;
};

type TmdbListResponse = { results: TmdbMovie[] };
type TmdbGenresResponse = { genres: Array<{ id: number; name: string }> };
type TmdbConfiguration = {
  images: {
    secure_base_url: string;
    poster_sizes: string[];
    backdrop_sizes: string[];
    profile_sizes: string[];
    logo_sizes: string[];
  };
};

type TmdbVideo = { key: string; site: string; type: string; official: boolean };
type TmdbCastCredit = { id: number; name: string; character: string; profile_path: string | null };
type TmdbCrewCredit = { name: string; job: string; department: string };
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
  similar: TmdbListResponse;
  release_dates: TmdbReleaseDatesResponse;
  external_ids: { imdb_id: string | null };
  "watch/providers": TmdbWatchProvidersResponse;
};

const REVALIDATE_SECONDS = 60 * 60;
const DEFAULT_REGION = "US";
const RELEASE_TYPE_LABELS: Record<number, string> = {
  1: "Premiere",
  2: "Limited Theatrical",
  3: "Theatrical",
  4: "Digital",
  5: "Physical",
  6: "TV",
};

function getConfig() {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN is not configured.");

  return {
    token,
    baseUrl: process.env.TMDB_API_BASE_URL || "https://api.themoviedb.org/3",
    language: process.env.TMDB_DEFAULT_LANGUAGE || "en-US",
  };
}

async function requestTmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { token, baseUrl, language } = getConfig();
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path}`);
  url.searchParams.set("language", language);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) throw new Error(`TMDb request failed with status ${response.status}.`);
  return response.json() as Promise<T>;
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
): Movie | null {
  const posterUrl = imageUrl(configuration.images.secure_base_url, configuration.images.poster_sizes, "w500", movie.poster_path);
  const backdropUrl = imageUrl(configuration.images.secure_base_url, configuration.images.backdrop_sizes, "w1280", movie.backdrop_path);

  if (!posterUrl) return null;

  return {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    releaseDate: movie.release_date,
    year: movie.release_date?.slice(0, 4) || "—",
    posterUrl,
    backdropUrl,
    genre: movie.genre_ids.map((id) => genres.get(id)).find(Boolean) || "Film",
    audienceScore: Math.round(movie.vote_average * 10),
  };
}

function mapMovies(
  response: TmdbListResponse,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
) {
  return response.results
    .map((movie) => toMovie(movie, configuration, genres))
    .filter((movie): movie is Movie => movie !== null);
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

export async function getMovieCatalog(): Promise<Catalog> {
  const [configuration, genreResponse, nowPlaying, popular, upcoming] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("movie/now_playing", { page: "1" }),
    requestTmdb<TmdbListResponse>("movie/popular", { page: "1" }),
    requestTmdb<TmdbListResponse>("movie/upcoming", { page: "1" }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const nowPlayingMovies = mapMovies(nowPlaying, configuration, genres);
  const popularMovies = mapMovies(popular, configuration, genres);
  const upcomingMovies = mapMovies(upcoming, configuration, genres).slice(0, 3);
  const featured = nowPlayingMovies.find((movie) => movie.backdropUrl) || popularMovies.find((movie) => movie.backdropUrl);

  if (!featured) throw new Error("TMDb returned no movies with usable artwork.");

  const releaseDatesList = await Promise.all(
    upcomingMovies.map((movie) => requestTmdb<TmdbReleaseDatesResponse>(`movie/${movie.id}/release_dates`)),
  );
  const releases: UpcomingMovie[] = upcomingMovies.map((movie, index) => ({
    ...movie,
    certification: pickCertification(usReleaseEntries(releaseDatesList[index])),
  }));

  return {
    featured,
    recommendations: popularMovies.filter((movie) => movie.id !== featured.id).slice(0, 4),
    releases,
  };
}

export async function getGenres(): Promise<Array<{ id: number; name: string }>> {
  const response = await requestTmdb<TmdbGenresResponse>("genre/movie/list");
  return response.genres;
}

export async function getPopularMovies(page = 1) {
  const [configuration, genreResponse, popular] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("movie/popular", { page: String(page) }),
  ]);
  return mapMovies(popular, configuration, new Map(genreResponse.genres.map((genre) => [genre.id, genre.name])));
}

export type DiscoverResult = { movies: Movie[]; page: number; totalPages: number; totalResults: number };

export async function getDiscoverMovies(params: Record<string, string>): Promise<DiscoverResult> {
  const [configuration, genreResponse, discover] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse & { page: number; total_pages: number; total_results: number }>("discover/movie", params),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));

  return {
    movies: mapMovies(discover, configuration, genres),
    page: discover.page,
    totalPages: discover.total_pages,
    totalResults: discover.total_results,
  };
}

export async function getSearchMovies(query: string, page = 1): Promise<DiscoverResult> {
  const [configuration, genreResponse, search] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse & { page: number; total_pages: number; total_results: number }>("search/movie", { query, page: String(page) }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));

  return {
    movies: mapMovies(search, configuration, genres),
    page: search.page,
    totalPages: search.total_pages,
    totalResults: search.total_results,
  };
}

export type WatchProviderOption = { id: number; name: string; logoUrl: string | null };

export async function getWatchProviders(region: string = DEFAULT_REGION): Promise<WatchProviderOption[]> {
  const [configuration, response] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<{ results: Array<{ provider_id: number; provider_name: string; logo_path: string | null; display_priority: number }> }>(
      "watch/providers/movie",
      { watch_region: region },
    ),
  ]);

  return response.results
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, 24)
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoUrl: imageUrl(configuration.images.secure_base_url, configuration.images.logo_sizes, "w92", provider.logo_path),
    }));
}

export async function resolvePerson(query: string): Promise<{ id: number; name: string } | null> {
  const response = await requestTmdb<{ results: Array<{ id: number; name: string }> }>("search/person", { query });
  return response.results[0] ?? null;
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
  const [configuration, genreResponse, detail] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbMovieDetail>(`movie/${id}`, {
      append_to_response: "videos,credits,similar,release_dates,external_ids,watch/providers",
    }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const movie = toMovie({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);

  if (!movie) throw new Error("TMDb returned a movie without a poster image.");

  const { secure_base_url, profile_sizes, logo_sizes } = configuration.images;
  const usEntries = usReleaseEntries(detail.release_dates);

  return {
    ...movie,
    runtime: detail.runtime,
    tagline: detail.tagline,
    genres: detail.genres.map((genre) => genre.name),
    certification: pickCertification(usEntries),
    imdbId: detail.external_ids.imdb_id,
    trailerKey: pickTrailerKey(detail.videos),
    director: pickDirector(detail.credits),
    cast: toCast(detail.credits.cast, secure_base_url, profile_sizes),
    similar: mapMovies(detail.similar, configuration, genres).slice(0, 8),
    releaseTimeline: usEntries
      .map((entry) => ({ type: RELEASE_TYPE_LABELS[entry.type] ?? "Release", date: entry.release_date }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    watchProviders: toWatchProviders(detail["watch/providers"], secure_base_url, logo_sizes),
  };
}
