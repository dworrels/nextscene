"use client";

import { useState, useTransition } from "react";
import { MovieGrid } from "@/components/movie-grid";
import type { MediaItem, PagedResult } from "@/types/tmdb";

const BATCH_SIZE = 32;

function dedupeItems(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const deduped: MediaItem[] = [];
  for (const item of items) {
    const itemKey = `${item.mediaType}-${item.id}`;
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    deduped.push(item);
  }
  return deduped;
}

export function PaginatedGrid({
  initialPage,
  loadMore,
}: {
  initialPage: PagedResult<MediaItem>;
  loadMore: (page: number) => Promise<PagedResult<MediaItem>>;
}) {
  const initialItems = dedupeItems(initialPage.items);
  const [items, setItems] = useState(initialItems.slice(0, BATCH_SIZE));
  const [buffer, setBuffer] = useState(initialItems.slice(BATCH_SIZE));
  const [page, setPage] = useState(initialPage.page);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const done = buffer.length === 0 && page >= totalPages;

  function fetchNextPage() {
    if (isPending || done) return;
    startTransition(async () => {
      try {
        let nextPage = page;
        let nextTotalPages = totalPages;
        let nextBuffer = [...buffer];

        while (nextBuffer.length < BATCH_SIZE && nextPage < nextTotalPages) {
          const next = await loadMore(nextPage + 1);
          nextPage = next.page;
          nextTotalPages = next.totalPages;
          nextBuffer = [...nextBuffer, ...next.items];
        }

        const dedupedBuffer = dedupeItems(nextBuffer);
        const added = dedupedBuffer.slice(0, BATCH_SIZE);
        setItems((current) => {
          const seen = new Set(current.map((item) => `${item.mediaType}-${item.id}`));
          return [...current, ...added.filter((item) => !seen.has(`${item.mediaType}-${item.id}`))];
        });
        setBuffer(dedupedBuffer.slice(BATCH_SIZE));
        setPage(nextPage);
        setTotalPages(nextTotalPages);
        setError(false);
      } catch {
        setError(true);
      }
    });
  }

  return <>
    <MovieGrid movies={items} />
    {!done || error ? <div className="mt-8 flex justify-center">
      <button className="min-h-11 rounded-full border border-line bg-soft px-5 py-2.5 text-sm font-semibold text-ink hover:bg-line disabled:cursor-wait disabled:opacity-60" disabled={isPending} onClick={fetchNextPage}>
        {isPending ? "Loading…" : error ? "Couldn’t load more — try again" : "Load more"}
      </button>
    </div> : null}
  </>;
}
