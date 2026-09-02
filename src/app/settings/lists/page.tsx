import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { RatingsDeleteButton } from "@/components/ratings-delete-button";
import { RatingsImportForm } from "@/components/ratings-import-form";
import { RatingsRepairRow } from "@/components/ratings-repair-row";
import { SiteHeader } from "@/components/site-header";
import { WatchlistDeleteButton } from "@/components/watchlist-delete-button";
import { WatchlistImportForm } from "@/components/watchlist-import-form";
import { WatchlistRepairRow } from "@/components/watchlist-repair-row";
import { readRatings } from "@/lib/ratings";
import { readWatchlist } from "@/lib/watchlist";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Lists — NextScene" };

export default async function SettingsListsPage() {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  const unmatchedRatings = ratingRows.filter((row) => row.tmdbId === null);
  const unmatchedWatchlist = watchlistRows.filter((row) => row.tmdbId === null);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width max-w-[720px] pt-[84px] max-[760px]:pt-11">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/settings" ariaLabel="Back to settings" mode="parent" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Lists</h1>
      <p className="mt-4 max-w-[560px] text-sm text-muted">Fix titles TMDb couldn&apos;t automatically match, replace a list with a fresh IMDb export, or delete it entirely.</p>

      <div className="mt-8 flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-soft p-5" id="ratings">
          <h2 className="m-0 text-base font-semibold text-ink">Ratings</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <RatingsImportForm variant="toolbar" />
            <RatingsDeleteButton />
          </div>
          {unmatchedRatings.length > 0 ? <div className="mt-4">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.02em] text-muted">{unmatchedRatings.length} need{unmatchedRatings.length === 1 ? "s" : ""} review</p>
            <div className="flex flex-col gap-2">
              {unmatchedRatings.map((row) => <RatingsRepairRow imdbId={row.imdbId} mediaType={row.mediaType} title={row.title} key={row.imdbId} />)}
            </div>
          </div> : null}
        </div>

        <div className="rounded-2xl border border-line bg-soft p-5" id="watchlist">
          <h2 className="m-0 text-base font-semibold text-ink">Watchlist</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <WatchlistImportForm variant="toolbar" />
            <WatchlistDeleteButton />
          </div>
          {unmatchedWatchlist.length > 0 ? <div className="mt-4">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.02em] text-muted">{unmatchedWatchlist.length} need{unmatchedWatchlist.length === 1 ? "s" : ""} review</p>
            <div className="flex flex-col gap-2">
              {unmatchedWatchlist.map((row) => <WatchlistRepairRow imdbId={row.imdbId} mediaType={row.mediaType} title={row.title} key={row.imdbId} />)}
            </div>
          </div> : null}
        </div>
      </div>
    </section>
  </main>;
}
