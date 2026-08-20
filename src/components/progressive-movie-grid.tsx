"use client";

import { useState } from "react";
import { MovieGrid } from "@/components/movie-grid";
import type { MediaItem } from "@/types/tmdb";

const BATCH_SIZE = 24;

export function ProgressiveMovieGrid({ items, predictedBadges }: { items: MediaItem[]; predictedBadges?: Record<string, string> }) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const visibleItems = items.slice(0, visibleCount);

  return <>
    <MovieGrid movies={visibleItems} predictedBadges={predictedBadges} />
    {visibleCount < items.length ? <div className="mt-8 flex justify-center">
      <button className="min-h-11 rounded-full border border-line bg-soft px-5 py-2.5 text-sm font-semibold text-ink hover:bg-line" onClick={() => setVisibleCount((count) => Math.min(count + BATCH_SIZE, items.length))} type="button">
        Load more
      </button>
    </div> : null}
  </>;
}
