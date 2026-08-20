import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { SiteHeader } from "@/components/site-header";
import { WatchlistImportForm } from "@/components/watchlist-import-form";
import { WatchlistSections } from "@/components/watchlist-sections";
import { getMediaCards } from "@/lib/tmdb";
import { readRatings } from "@/lib/ratings";
import { readWatchlist } from "@/lib/watchlist";
import type { MediaItem } from "@/types/tmdb";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Your Watchlist — NextScene" };

export default async function WatchlistPage() {
  const [{ rows }, { rows: ratingRows }] = await Promise.all([readWatchlist(), readRatings()]);
  const ratedImdbIds = new Set(ratingRows.map((row) => row.imdbId));
  const ratedMediaKeys = new Set(ratingRows
    .filter((row) => row.tmdbId !== null)
    .map((row) => `${row.mediaType}-${row.tmdbId}`));
  const savedRows = rows.filter((row) => (
    !ratedImdbIds.has(row.imdbId)
    && (row.tmdbId === null || !ratedMediaKeys.has(`${row.mediaType}-${row.tmdbId}`))
  ));
  const matched = savedRows.filter((row) => row.tmdbId !== null).sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  const unmatched = savedRows.filter((row) => row.tmdbId === null);

  const cards = matched.length > 0
    ? await getMediaCards(matched.map((row) => ({ id: row.tmdbId as number, mediaType: row.mediaType }))).catch(() => null)
    : new Map<string, MediaItem>();

  const today = new Date().toISOString().slice(0, 10);
  const available = matched.flatMap((row) => {
    const card = cards?.get(`${row.mediaType}-${row.tmdbId}`);
    return row.status !== "upcoming" && row.status !== "metadata_pending" && card && card.releaseDate <= today ? [card] : [];
  });
  const upcoming = matched.flatMap((row) => {
    const card = cards?.get(`${row.mediaType}-${row.tmdbId}`);
    return row.status === "upcoming" || (row.status !== "metadata_pending" && card && card.releaseDate > today) ? card ? [card] : [] : [];
  });
  const dedupe = (items: MediaItem[]) => [...new Map(items.map((item) => [`${item.mediaType}-${item.id}`, item])).values()];
  const availableItems = dedupe(available);
  const upcomingItems = dedupe(upcoming);
  const pending = savedRows
    .filter((row) => row.status === "metadata_pending")
    .map((row) => ({ title: row.title, item: row.tmdbId === null ? null : cards?.get(`${row.mediaType}-${row.tmdbId}`) ?? null }));

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Your Watchlist</h1>
          {savedRows.length > 0 ? <p className="mt-4 text-sm text-muted">Choose which parts of your saved list to browse.</p> : null}
        </div>
        {unmatched.length > 0 ? <Link className="inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2 text-xs font-semibold text-ink hover:bg-soft" href="/watchlist/review">{unmatched.length} need review</Link> : null}
      </div>
    </section>

    <section className="page-width">
      {savedRows.length === 0
        ? <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
          <h2 className="m-0 text-[22px] font-[650] leading-[1.12] tracking-[-0.02em]">No watchlist imported yet</h2>
          <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">Import your IMDb watchlist export to see it here.</p>
          <WatchlistImportForm variant="empty" />
        </div>
        : cards === null
          ? <CatalogError />
          : <WatchlistSections available={availableItems} upcoming={upcomingItems} pending={pending} />}
    </section>
  </main>;
}
