"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { PaginatedGrid } from "@/components/paginated-grid";
import { browseCategory, getInitialBrowseCategory, searchMediaPage } from "@/lib/browse-actions";
import { BROWSE_CATEGORIES } from "@/lib/browse-categories";
import type { MediaItem, PagedResult } from "@/types/tmdb";

type ResultsView = { key: string; page: PagedResult<MediaItem> };

// Clicking a result navigates away entirely (this overlay lives inside the
// per-page SiteHeader, not a shared layout), so hitting back remounts it
// from scratch. Restoring the query from sessionStorage — SiteHeader does
// the same for whether the overlay was open at all — means the search comes
// back instead of starting empty. See SiteHeader's SEARCH_OPEN_KEY.
const SEARCH_QUERY_KEY = "nextscene-search-query";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(() => window.sessionStorage.getItem(SEARCH_QUERY_KEY) ?? "");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [resultsView, setResultsView] = useState<ResultsView | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], input, iframe, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const page = await searchMediaPage(trimmed);
        if (requestId === requestIdRef.current) setResultsView({ key: `search:${trimmed}`, page });
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    requestIdRef.current++;
    setQuery(value);
    if (value) window.sessionStorage.setItem(SEARCH_QUERY_KEY, value); else window.sessionStorage.removeItem(SEARCH_QUERY_KEY);
    setActiveCategory(null);
    setResultsView(null);
  }

  function handleCategoryClick(key: string) {
    const requestId = ++requestIdRef.current;
    setQuery("");
    window.sessionStorage.removeItem(SEARCH_QUERY_KEY);
    setActiveCategory(key);
    setResultsView(null);
    startTransition(async () => {
      const page = await getInitialBrowseCategory(key);
      if (requestId === requestIdRef.current) setResultsView({ key: `category:${key}`, page });
    });
  }

  const showBrowse = !query.trim() && !activeCategory;
  const activeLabel = BROWSE_CATEGORIES.find((category) => category.key === activeCategory)?.label;

  return <div className="fixed inset-0 z-[200] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Search" ref={dialogRef}>
    <div className="page-width sticky top-0 z-10 flex items-center gap-4 bg-bg pb-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 items-center gap-3 rounded-full border border-line bg-soft px-5 py-3 focus-within:border-ink">
        <Search className="h-4 w-4 flex-none text-muted" strokeWidth={1.8} aria-hidden="true" />
        <input
          className="w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search movies and TV shows…"
          ref={inputRef}
          type="text"
          value={query}
        />
      </div>
      <button aria-label="Close search" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-soft text-ink hover:bg-line" onClick={onClose}>
        <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>

    <div className="page-width pb-24">
      {showBrowse ? <>
        <h2 className="m-0 mb-4 text-lg font-semibold text-ink">Browse</h2>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[760px]:grid-cols-4">
          {BROWSE_CATEGORIES.map((category) => <button
            className={`group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-center transition-transform duration-200 ease-out hover:scale-[1.02] ${category.gradient}`}
            key={category.key}
            onClick={() => handleCategoryClick(category.key)}
          >
            <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
            <span className="relative text-xl font-bold leading-tight text-white drop-shadow-sm">{category.label}</span>
          </button>)}
        </div>
      </> : <>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-semibold text-ink">{activeCategory ? activeLabel : `Results for "${query}"`}</h2>
        </div>
        {isPending && !resultsView
          ? <p className="text-sm text-muted">Searching…</p>
          : !resultsView || resultsView.page.items.length === 0
            ? <p className="text-sm text-muted">No results found.</p>
            : <PaginatedGrid
              initialPage={resultsView.page}
              key={resultsView.key}
              loadMore={activeCategory ? browseCategory.bind(null, activeCategory) : searchMediaPage.bind(null, query.trim())}
            />}
      </>}
    </div>
  </div>;
}
