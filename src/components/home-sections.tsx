import { CatalogError } from "@/components/catalog-state";
import { MovieHero } from "@/components/movie-hero";
import { MovieRail } from "@/components/movie-rail";
import { ReleaseTracker } from "@/components/release-tracker";
import { getWhatToWatch } from "@/lib/recommendations";
import {
  getAiringTodayTvShows,
  getHomeMovieCatalog,
  getNowPlayingMovies,
  getOnTheAirTvShows,
  getPopularTvShows,
  getTopRatedMovies,
  getTopRatedTvShows,
  getUpcomingMovieReleases,
} from "@/lib/tmdb";

export function HomeRailSkeleton() {
  return <section aria-busy="true" className="page-width pt-14 max-[760px]:pt-9">
    <div className="mb-[18px] h-6 w-36 animate-pulse rounded bg-soft max-[760px]:mb-3.5" />
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }, (_, index) => <div className="h-[222px] w-[148px] flex-none animate-pulse rounded-xl bg-soft" key={index} />)}
    </div>
  </section>;
}

export async function HomePrimarySection() {
  const catalog = await getHomeMovieCatalog().catch(() => null);
  if (!catalog) return <CatalogError />;

  return <MovieHero movie={catalog.featured} />;
}

export async function HomePopularMoviesSection() {
  const catalog = await getHomeMovieCatalog().catch(() => null);
  return <MovieRail href="/browse/popular-movies" items={catalog?.recommendations ?? []} title="Popular Movies" />;
}

export async function HomeDiscoverySections() {
  const [popularTv, topRatedMovies, topRatedTv, nowPlaying, onTheAir, airingToday] = await Promise.all([
    getPopularTvShows().catch(() => null),
    getTopRatedMovies().catch(() => null),
    getTopRatedTvShows().catch(() => null),
    getNowPlayingMovies().catch(() => null),
    getOnTheAirTvShows().catch(() => null),
    getAiringTodayTvShows().catch(() => null),
  ]);

  return <>
    <MovieRail href="/browse/popular-tv" items={popularTv?.items ?? []} title="Popular TV Shows" />
    <MovieRail href="/browse/top-rated-movies" items={topRatedMovies?.items ?? []} title="Top Rated Movies" />
    <MovieRail href="/browse/top-rated-tv" items={topRatedTv?.items ?? []} title="Top Rated TV Shows" />
    <MovieRail href="/browse/now-playing" items={nowPlaying?.items ?? []} title="In Theaters Now" />
    <MovieRail href="/browse/on-the-air" items={onTheAir?.items ?? []} title="Airing This Week" />
    <MovieRail href="/browse/airing-today" items={airingToday?.items ?? []} title="Airing Today" />
  </>;
}

export async function HomePersonalizedSection() {
  const whatToWatch = await getWhatToWatch().catch(() => null);
  const items = whatToWatch?.rails.flatMap((rail) => rail.items).slice(0, 8) ?? [];
  const predictedBadges = Object.assign({}, ...(whatToWatch?.rails.map((rail) => rail.predictedBadges ?? {}) ?? []));
  return <MovieRail href="/what-to-watch" items={items} predictedBadges={predictedBadges} title="What to Watch" />;
}

export async function HomeReleasesSection() {
  const releases = await getUpcomingMovieReleases().catch(() => []);
  return <ReleaseTracker movies={releases} />;
}
