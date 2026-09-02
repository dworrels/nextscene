import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { MovieRail } from "@/components/movie-rail";
import { SemanticSearch } from "@/components/semantic-search";
import { SiteHeader } from "@/components/site-header";
import { getWhatToWatch } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "What to Watch — NextScene" };

export default async function WhatToWatchPage() {
  const { hasRatings, rails } = await getWhatToWatch();

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">What to Watch</h1>
      <p className="mt-4 max-w-[520px] text-sm text-muted">
        {hasRatings
          ? "Personalized using your ratings, preferences, and viewing history, with a little discovery mixed in."
          : "Import ratings to get picks built around what you like and avoid."}
      </p>
    </section>

    <section className="page-width pb-10">
      <div className="rounded-2xl bg-soft px-8 py-6 max-[760px]:px-6">
        <h2 className="m-0 mb-1 text-[20px] font-[650] tracking-[-0.02em]">Ask for something to watch</h2>
        <p className="mb-4 text-sm text-muted">Describe a mood, mention a movie you love, or ask for something specific.</p>
        <SemanticSearch />
      </div>
    </section>

    {!hasRatings
      ? <section className="page-width">
        <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
          <h2 className="m-0 text-[22px] font-[650] leading-[1.12] tracking-[-0.02em]">Import your ratings first</h2>
          <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">Recommendations are built from your taste profile — import your IMDb ratings export from the home page to get started.</p>
        </div>
      </section>
      : rails.length === 0
        ? <section className="page-width"><p className="text-sm text-muted">Couldn&apos;t load recommendations right now. Try refreshing in a bit.</p></section>
        : rails.map((rail) => <MovieRail title={rail.title} items={rail.items} predictedBadges={rail.predictedBadges} href={`/what-to-watch/${rail.key}`} key={rail.key} />)}
  </main>;
}
