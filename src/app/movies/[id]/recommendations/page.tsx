import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { getInitialMovieRecommendations, loadMovieRecommendations } from "@/lib/browse-actions";
import { getMovieTitle, isTmdbNotFound } from "@/lib/tmdb";

export const revalidate = 3600;

function parseMovieId(id: string) {
  const movieId = Number(id);
  return Number.isInteger(movieId) && movieId > 0 ? movieId : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const movieId = parseMovieId(id);
  if (!movieId) return {};

  const title = await getMovieTitle(movieId).catch(() => null);
  if (!title) return {};

  return { title: `Related to ${title} — NextScene` };
}

export default async function MovieRecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = parseMovieId(id);
  if (!movieId) notFound();

  const [titleResult, itemsResult] = await Promise.allSettled([
    getMovieTitle(movieId),
    getInitialMovieRecommendations(movieId),
  ]);

  if (titleResult.status === "rejected") {
    if (isTmdbNotFound(titleResult.reason)) notFound();
    return <main className="pb-24"><SiteHeader /><CatalogError /></main>;
  }

  const title = titleResult.value;
  const items = itemsResult.status === "fulfilled" ? itemsResult.value : null;

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref={`/movies/${movieId}`} ariaLabel={`Back to ${title}`} />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Related</h1>
      <p className="mt-3 text-lg font-medium text-muted">{title}</p>
    </section>

    <section className="page-width">
      {items === null
        ? <CatalogError />
        : items.items.length > 0
          ? <PaginatedGrid initialPage={items} loadMore={loadMovieRecommendations.bind(null, movieId)} />
          : <p className="text-sm text-muted">No related titles found.</p>}
    </section>
  </main>;
}
