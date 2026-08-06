import Link from "next/link";
import { CatalogError } from "@/components/catalog-state";
import { Mark } from "@/components/icons";
import { MovieHero } from "@/components/movie-hero";
import { MovieRail } from "@/components/movie-rail";
import { ReleaseTracker } from "@/components/release-tracker";
import { SiteHeader } from "@/components/site-header";
import { TasteProfile } from "@/components/taste-profile";
import { getMovieCatalog, getPopularTvShows, getTopRatedMovies, getTopRatedTvShows } from "@/lib/tmdb";

export const revalidate = 3600;

export default async function Home() {
  const [catalog, popularTv, topRatedMovies, topRatedTv] = await Promise.all([
    getMovieCatalog().catch(() => null),
    getPopularTvShows().catch(() => null),
    getTopRatedMovies().catch(() => null),
    getTopRatedTvShows().catch(() => null),
  ]);

  return <main>
    <SiteHeader />
    {catalog ? <>
      <MovieHero movie={catalog.featured} />
      <MovieRail title="Popular Movies" items={catalog.recommendations} href="/browse/popular-movies" />
      <MovieRail title="Popular TV Shows" items={popularTv?.items ?? []} href="/browse/popular-tv" />
      <MovieRail title="Top Rated Movies" items={topRatedMovies?.items ?? []} href="/browse/top-rated-movies" />
      <MovieRail title="Top Rated TV Shows" items={topRatedTv?.items ?? []} href="/browse/top-rated-tv" />
      <TasteProfile />
      <ReleaseTracker movies={catalog.releases} />
    </> : <CatalogError />}
    <footer className="page-width grid min-h-[155px] max-[760px]:min-h-[180px] grid-cols-[auto_1fr_auto] max-[760px]:grid-cols-1 items-start gap-[30px] max-[760px]:gap-2 border-t border-line pt-[42px] pb-6">
      <Link className="inline-flex items-center gap-[7px] whitespace-nowrap text-base font-semibold tracking-[-0.02em]" href="/"><Mark /> <span>NextScene</span></Link>
      <p className="mt-[3px] text-[11px] text-muted">Personal recommendations, considered.</p>
      <p className="mt-[3px] max-[760px]:mt-3 max-w-[250px] text-[10px] leading-[1.4] text-right text-muted max-[760px]:text-left">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </footer>
  </main>;
}
