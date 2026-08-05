export type Movie = {
  id: number;
  title: string;
  overview: string;
  releaseDate: string;
  year: string;
  posterUrl: string;
  backdropUrl: string | null;
  genre: string;
  audienceScore: number;
};

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
  cast: CastMember[];
  similar: Movie[];
  releaseTimeline: ReleaseTimelineEntry[];
  watchProviders: WatchProviders;
};

export type Catalog = {
  featured: Movie;
  recommendations: Movie[];
  releases: UpcomingMovie[];
};
