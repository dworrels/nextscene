export type MediaType = "movie" | "tv";

export type MediaItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  releaseDate: string;
  year: string;
  posterUrl: string;
  backdropUrl: string | null;
  genre: string;
  audienceScore: number;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export type Movie = MediaItem & { mediaType: "movie" };
export type TvShow = MediaItem & { mediaType: "tv" };

export type UpcomingMovie = Movie & {
  certification: string | null;
};

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profileUrl: string | null;
};

export type WatchProvider = {
  id: number;
  name: string;
  logoUrl: string | null;
};

export type WatchProviders = {
  link: string | null;
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
};

export type ReleaseTimelineEntry = {
  type: string;
  date: string;
};

export type MovieDetail = Movie & {
  runtime: number | null;
  tagline: string;
  genres: string[];
  certification: string | null;
  imdbId: string | null;
  trailerKey: string | null;
  director: string | null;
  originalLanguage: string | null;
  cast: CastMember[];
  recommendations: Movie[];
  releaseTimeline: ReleaseTimelineEntry[];
  watchProviders: WatchProviders;
};

export type Catalog = {
  featured: Movie;
  recommendations: Movie[];
  releases: UpcomingMovie[];
};

export type SeasonSummary = {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterUrl: string | null;
  airDate: string | null;
  episodeCount: number;
};

export type TvShowDetail = TvShow & {
  tagline: string;
  genres: string[];
  certification: string | null;
  imdbId: string | null;
  trailerKey: string | null;
  creators: string[];
  originalLanguage: string | null;
  cast: CastMember[];
  recommendations: TvShow[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  episodeRuntime: number | null;
  status: string;
  networks: string[];
  seasons: SeasonSummary[];
  watchProviders: WatchProviders;
};

export type Episode = {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillUrl: string | null;
  airDate: string | null;
  runtime: number | null;
  audienceScore: number;
};

export type SeasonDetail = {
  showId: number;
  showName: string;
  seasonNumber: number;
  name: string;
  overview: string;
  posterUrl: string | null;
  airDate: string | null;
  episodes: Episode[];
};

export type EpisodeDetail = Episode & {
  showId: number;
  showName: string;
  crew: Array<{ id: number; name: string; job: string }>;
  guestStars: CastMember[];
};
