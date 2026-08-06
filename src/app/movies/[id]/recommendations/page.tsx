import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { loadMovieRecommendations } from "@/lib/browse-actions";
import { getMovieTitle } from "@/lib/tmdb";

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

  const [title, items] = await Promise.all([
    getMovieTitle(movieId).catch(() => notFound()),
    loadMovieRecommendations(movieId, 1),
  ]);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <Link className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink" href={`/movies/${movieId}`}><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to {title}</Link>
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Related</h1>
      <p className="mt-3 text-lg font-medium text-muted">{title}</p>
    </section>

    <section className="page-width">
      <PaginatedGrid initialPage={items} loadMore={loadMovieRecommendations.bind(null, movieId)} />
    </section>
  </main>;
}
