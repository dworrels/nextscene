"use client";

import { ChevronDown } from "lucide-react";
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
  const [activeSection, setActiveSection] = useState<keyof typeof sectionLabels>("available");
  const pendingCards = pending.flatMap(({ item }) => item ? [item] : []);
  const unmatchedPending = pending.filter(({ item }) => item === null);
  const sections = [
    { key: "available" as const, title: "Available now", count: available.length },
    { key: "upcoming" as const, title: "Coming later", count: upcoming.length },
    { key: "pending" as const, title: "Awaiting release details", count: pending.length },
  ];
  const activeTitle = sectionLabels[activeSection];

  return <div>
    <div className="mb-8">
      <div className="min-[760px]:hidden">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted" htmlFor="watchlist-filter">Watchlist category</label>
        <div className="relative">
          <select className="min-h-11 w-full appearance-none rounded-xl border border-line bg-soft py-2 pl-3 pr-10 text-sm font-semibold text-ink outline-none focus:border-ink" id="watchlist-filter" value={activeSection} onChange={(event) => setActiveSection(event.target.value as keyof typeof sectionLabels)}>
            {sections.map((section) => <option key={section.key} value={section.key}>{section.title} ({section.count})</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.8} aria-hidden="true" />
        </div>
      </div>
      <div className="hidden gap-2 min-[760px]:flex min-[760px]:flex-wrap" aria-label="Watchlist sections">
        {sections.map((section) => <button aria-pressed={activeSection === section.key} className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${activeSection === section.key ? "border-ink bg-ink text-bg" : "border-line bg-soft text-ink hover:bg-line"}`} key={section.key} onClick={() => setActiveSection(section.key)} type="button">
          {section.title} ({section.count})
        </button>)}
      </div>
    </div>

    <div>
      {activeSection === "available" && available.length > 0 ? <section>
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">{activeTitle}</h2>
        <MovieGrid movies={available} />
      </section> : null}
      {activeSection === "upcoming" && upcoming.length > 0 ? <section>
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">{activeTitle}</h2>
        <MovieGrid movies={upcoming} />
      </section> : null}
      {activeSection === "pending" && pending.length > 0 ? <section>
        <h2 className="m-0 mb-2 text-[20px] font-[650] tracking-[-0.02em]">{activeTitle}</h2>
        <p className="mb-4 text-sm text-muted">These are announced titles without a confirmed release date yet.</p>
        {pendingCards.length > 0 ? <MovieGrid movies={pendingCards} /> : null}
        {unmatchedPending.length > 0 ? <ul className="mt-4 flex flex-wrap gap-2 p-0" aria-label="Titles awaiting metadata">
          {unmatchedPending.map(({ title }) => <li className="list-none rounded-full border border-line bg-soft px-3 py-2 text-sm text-ink" key={title}>{title}</li>)}
        </ul> : null}
      </section> : null}
    </div>
  </div>;
}

const sectionLabels = {
  available: "Available now",
  upcoming: "Coming later",
  pending: "Awaiting release details",
} as const;
