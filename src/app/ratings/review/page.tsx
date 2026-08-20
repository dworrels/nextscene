import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { RatingsDeleteButton } from "@/components/ratings-delete-button";
import { RatingsImportForm } from "@/components/ratings-import-form";
import { RatingsRepairRow } from "@/components/ratings-repair-row";
import { SiteHeader } from "@/components/site-header";
import { readRatings } from "@/lib/ratings";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Review Ratings — NextScene" };

export default async function RatingsReviewPage() {
  const { rows } = await readRatings();
  const unmatched = rows.filter((row) => row.tmdbId === null);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-6">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/ratings" ariaLabel="Back to your ratings" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Review &amp; Manage</h1>
      <p className="mt-4 text-sm text-muted">
        {rows.length === 0
          ? "You haven't imported any ratings yet."
          : unmatched.length > 0
            ? `${unmatched.length} title${unmatched.length === 1 ? "" : "s"} need review.`
            : "Everything in your list is matched to TMDb."}
      </p>
    </section>

    {rows.length > 0 ? <section className="page-width flex flex-wrap items-center gap-3 pb-10">
      <Link className="inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2 text-xs font-semibold text-ink hover:bg-soft" href="/ratings">View all ratings</Link>
      <RatingsImportForm variant="toolbar" />
      <RatingsDeleteButton />
    </section> : null}

    {unmatched.length > 0 ? <section className="page-width">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Needs review</h2>
      <div className="flex flex-col gap-2">
        {unmatched.map((row) => <RatingsRepairRow imdbId={row.imdbId} mediaType={row.mediaType} title={row.title} key={row.imdbId} />)}
      </div>
    </section> : null}
  </main>;
}
