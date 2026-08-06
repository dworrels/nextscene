"use client";

import { useCallback, useState, useTransition } from "react";
import { MovieGrid } from "@/components/movie-grid";
import type { MediaItem, PagedResult } from "@/types/tmdb";

export function PaginatedGrid({
  initialPage,
  loadMore,
}: {
  initialPage: PagedResult<MediaItem>;
  loadMore: (page: number) => Promise<PagedResult<MediaItem>>;
}) {
  const [items, setItems] = useState(initialPage.items);
  const [page, setPage] = useState(initialPage.page);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const done = page >= totalPages;

  const fetchNextPage = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await loadMore(page + 1);
        setItems((current) => [...current, ...next.items]);
        setPage(next.page);
        setTotalPages(next.totalPages);
        setError(false);
      } catch {
        setError(true);
      }
    });
  }, [page, loadMore]);

  return <>
    <MovieGrid movies={items} />
    {!done || error ? <div className="mt-8 flex justify-center">
      <button className="rounded-full border border-line bg-soft px-5 py-2.5 text-sm font-semibold text-ink hover:bg-line disabled:cursor-wait disabled:opacity-60" disabled={isPending} onClick={fetchNextPage}>
        {isPending ? "Loading…" : error ? "Couldn’t load more — try again" : "Load more"}
      </button>
    </div> : null}
  </>;
}
