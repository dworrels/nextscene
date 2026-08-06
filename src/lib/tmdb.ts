import type {
  CastMember,
  Catalog,
  Episode,
  EpisodeDetail,
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
    mediaType: "movie",
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
): TvShow | null {
  const posterUrl = imageUrl(configuration.images.secure_base_url, configuration.images.poster_sizes, "w500", tv.poster_path);
  const backdropUrl = imageUrl(configuration.images.secure_base_url, configuration.images.backdrop_sizes, "w1280", tv.backdrop_path);

  if (!posterUrl) return null;

  return {
    id: tv.id,
    mediaType: "tv",
    title: tv.name,
    overview: tv.overview,
    releaseDate: tv.first_air_date,
    year: tv.first_air_date?.slice(0, 4) || "—",
    posterUrl,
    backdropUrl,
    genre: tv.genre_ids.map((id) => genres.get(id)).find(Boolean) || "Series",
    audienceScore: Math.round(tv.vote_average * 10),
  };
}

function mapTvShows(
  response: TmdbTvListResponse,
  configuration: TmdbConfiguration,
  genres: Map<number, string>,
) {
  return response.results
    .map((tv) => toTvShow(tv, configuration, genres))
    .filter((tv): tv is TvShow => tv !== null);
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
  const upcomingMovies = mapMovies(upcoming, configuration, genres).slice(0, 12);
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
    recommendations: popularMovies.filter((movie) => movie.id !== featured.id),
    releases,
  };
}

async function listMovies(path: string, page: number) {
  const [configuration, genreResponse, response] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>(path, { page: String(page) }),
  ]);
  return toPagedResult(response, mapMovies(response, configuration, new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]))));
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
  return listMovies("movie/upcoming", page);
}

export async function getSearchMovies(query: string, page = 1) {
  const [configuration, genreResponse, search] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>("search/movie", { query, page: String(page) }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(search, mapMovies(search, configuration, genres));
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
      append_to_response: "videos,credits,recommendations,release_dates,external_ids,watch/providers",
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
    originalLanguage: languageName(detail.original_language),
    cast: toCast(detail.credits.cast, secure_base_url, profile_sizes),
    recommendations: mapMovies(detail.recommendations, configuration, genres),
    releaseTimeline: usEntries
      .map((entry) => ({ type: RELEASE_TYPE_LABELS[entry.type] ?? "Release", date: entry.release_date }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    watchProviders: toWatchProviders(detail["watch/providers"], secure_base_url, logo_sizes),
  };
}

export async function getMovieTitle(id: number): Promise<string> {
  const detail = await requestTmdb<{ title: string }>(`movie/${id}`);
  return detail.title;
}

export async function getMovieRecommendations(id: number, page = 1) {
  const [configuration, genreResponse, response] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/movie/list"),
    requestTmdb<TmdbListResponse>(`movie/${id}/recommendations`, { page: String(page) }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, mapMovies(response, configuration, genres));
}

async function listTvShows(path: string, page: number) {
  const [configuration, genreResponse, response] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>(path, { page: String(page) }),
  ]);
  return toPagedResult(response, mapTvShows(response, configuration, new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]))));
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
  const [configuration, genreResponse, search] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>("search/tv", { query, page: String(page) }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(search, mapTvShows(search, configuration, genres));
}

export async function findTvByImdbId(imdbId: string): Promise<number | null> {
  const response = await requestTmdb<{ tv_results: TmdbTv[] }>(`find/${imdbId}`, { external_source: "imdb_id" });
  return response.tv_results[0]?.id ?? null;
}

export async function searchTvId(query: string): Promise<number | null> {
  const response = await requestTmdb<{ results: Array<{ id: number }> }>("search/tv", { query });
  return response.results[0]?.id ?? null;
}

export async function getTvDetails(id: number): Promise<TvShowDetail> {
  const [configuration, genreResponse, detail] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvDetail>(`tv/${id}`, {
      append_to_response: "videos,credits,recommendations,content_ratings,external_ids,watch/providers",
    }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  const tv = toTvShow({ ...detail, genre_ids: detail.genres.map((genre) => genre.id) }, configuration, genres);

  if (!tv) throw new Error("TMDb returned a TV show without a poster image.");

  const { secure_base_url, profile_sizes, logo_sizes, poster_sizes } = configuration.images;

  return {
    ...tv,
    tagline: detail.tagline,
    genres: detail.genres.map((genre) => genre.name),
    certification: pickTvCertification(detail.content_ratings),
    imdbId: detail.external_ids.imdb_id,
    trailerKey: pickTrailerKey(detail.videos),
    creators: detail.created_by.map((creator) => creator.name),
    originalLanguage: languageName(detail.original_language),
    cast: toCast(detail.credits.cast, secure_base_url, profile_sizes),
    recommendations: mapTvShows(detail.recommendations, configuration, genres),
    numberOfSeasons: detail.number_of_seasons,
    numberOfEpisodes: detail.number_of_episodes,
    episodeRuntime: detail.episode_run_time[0] ?? null,
    status: detail.status,
    networks: detail.networks.map((network) => network.name),
    seasons: detail.seasons
      .filter((season) => season.season_number > 0)
      .map((season) => toSeasonSummary(season, secure_base_url, poster_sizes)),
    watchProviders: toWatchProviders(detail["watch/providers"], secure_base_url, logo_sizes),
  };
}

export async function getTvRecommendations(id: number, page = 1) {
  const [configuration, genreResponse, response] = await Promise.all([
    requestTmdb<TmdbConfiguration>("configuration"),
    requestTmdb<TmdbGenresResponse>("genre/tv/list"),
    requestTmdb<TmdbTvListResponse>(`tv/${id}/recommendations`, { page: String(page) }),
  ]);
  const genres = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
  return toPagedResult(response, mapTvShows(response, configuration, genres));
}

export async function getTvShowName(id: number): Promise<string> {
  const detail = await requestTmdb<{ name: string }>(`tv/${id}`);
  return detail.name;
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
