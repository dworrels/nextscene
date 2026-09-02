import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { FilmCard } from "@/components/film-card";
import { SiteHeader } from "@/components/site-header";
import { readRatings } from "@/lib/ratings";
import { getMediaCards } from "@/lib/tmdb";
import type { MediaItem } from "@/types/tmdb";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Your Ratings — NextScene" };

export default async function RatingsPage() {
  const { rows } = await readRatings();
  const matched = rows.filter((row) => row.tmdbId !== null).sort((a, b) => b.rating - a.rating);

  const cards = matched.length > 0
    ? await getMediaCards(matched.map((row) => ({ id: row.tmdbId as number, mediaType: row.mediaType }))).catch(() => null)
    : new Map<string, MediaItem>();

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Your Ratings</h1>
      {matched.length > 0 ? <p className="mt-4 text-sm text-muted">{matched.length} rated title{matched.length === 1 ? "" : "s"}, highest rated first.</p> : null}
    </section>

    <section className="page-width">
      {rows.length === 0
        ? <p className="text-sm text-muted">You haven&apos;t imported any ratings yet. Import your IMDb ratings export from the home page.</p>
        : cards === null
          ? <CatalogError />
          : <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] min-[760px]:gap-4">
            {matched.map((row) => {
              const card = cards.get(`${row.mediaType}-${row.tmdbId}`);
              return card ? <FilmCard movie={card} badge={`${row.rating}/10`} fluid key={row.imdbId} /> : null;
            })}
          </div>}
    </section>
  </main>;
}
