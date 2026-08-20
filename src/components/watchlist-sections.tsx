"use client";

import { useState } from "react";
import { MovieGrid } from "@/components/movie-grid";
import type { MediaItem } from "@/types/tmdb";

type PendingTitle = { title: string; item: MediaItem | null };

export function WatchlistSections({
  available,
  upcoming,
  pending,
}: {
  available: MediaItem[];
  upcoming: MediaItem[];
  pending: PendingTitle[];
}) {
  const [visible, setVisible] = useState({ available: true, upcoming: true, pending: true });
  const pendingCards = pending.flatMap(({ item }) => item ? [item] : []);
  const unmatchedPending = pending.filter(({ item }) => item === null);

  function toggle(section: keyof typeof visible) {
    setVisible((current) => ({ ...current, [section]: !current[section] }));
  }

  const toggleClass = (active: boolean) => `min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${active ? "border-ink bg-ink text-bg" : "border-line bg-soft text-ink hover:bg-line"}`;

  return <div>
    <div className="mb-8 flex flex-wrap gap-2" aria-label="Watchlist sections">
      <button aria-pressed={visible.available} className={toggleClass(visible.available)} onClick={() => toggle("available")}>
        {available.length} available now
      </button>
      <button aria-pressed={visible.upcoming} className={toggleClass(visible.upcoming)} onClick={() => toggle("upcoming")}>
        {upcoming.length} coming later
      </button>
      <button aria-pressed={visible.pending} className={toggleClass(visible.pending)} onClick={() => toggle("pending")}>
        {pending.length} awaiting release details
      </button>
    </div>

    <div className="space-y-12">
      {visible.available && available.length > 0 ? <section>
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Available now</h2>
        <MovieGrid movies={available} />
      </section> : null}
      {visible.upcoming && upcoming.length > 0 ? <section>
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Coming later</h2>
        <MovieGrid movies={upcoming} />
      </section> : null}
      {visible.pending && pending.length > 0 ? <section>
        <h2 className="m-0 mb-2 text-[20px] font-[650] tracking-[-0.02em]">Awaiting release details</h2>
        <p className="mb-4 text-sm text-muted">These are announced titles without a confirmed release date yet.</p>
        {pendingCards.length > 0 ? <MovieGrid movies={pendingCards} /> : null}
        {unmatchedPending.length > 0 ? <ul className="mt-4 flex flex-wrap gap-2 p-0" aria-label="Titles awaiting metadata">
          {unmatchedPending.map(({ title }) => <li className="list-none rounded-full border border-line bg-soft px-3 py-2 text-sm text-ink" key={title}>{title}</li>)}
        </ul> : null}
      </section> : null}
    </div>
  </div>;
}
