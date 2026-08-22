"use client";

import { useEffect, useState } from "react";
import { MovieGrid } from "@/components/movie-grid";
import type { MediaItem } from "@/types/tmdb";

const BATCH_SIZE = 24;
const STATE_TTL_MS = 30 * 60 * 1000;

function readVisibleCount(stateKey: string | undefined): number | null {
  if (!stateKey || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(`nextscene-progressive-grid:${stateKey}`) ?? "null") as { visibleCount?: unknown; savedAt?: unknown } | null;
    return value && typeof value.visibleCount === "number" && typeof value.savedAt === "number" && Date.now() - value.savedAt < STATE_TTL_MS
      ? value.visibleCount
      : null;
  } catch {
    return null;
  }
}

export function ProgressiveMovieGrid({ items, predictedBadges, stateKey }: { items: MediaItem[]; predictedBadges?: Record<string, string>; stateKey?: string }) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(readVisibleCount(stateKey) ?? BATCH_SIZE, items.length));
  const visibleItems = items.slice(0, visibleCount);

  useEffect(() => {
    if (!stateKey) return;
    window.sessionStorage.setItem(`nextscene-progressive-grid:${stateKey}`, JSON.stringify({ visibleCount, savedAt: Date.now() }));
  }, [stateKey, visibleCount]);

  return <>
    <MovieGrid movies={visibleItems} predictedBadges={predictedBadges} />
    {visibleCount < items.length ? <div className="mt-8 flex justify-center">
      <button className="min-h-11 rounded-full border border-line bg-soft px-5 py-2.5 text-sm font-semibold text-ink hover:bg-line" onClick={() => setVisibleCount((count) => Math.min(count + BATCH_SIZE, items.length))} type="button">
        Load more
      </button>
    </div> : null}
  </>;
}
