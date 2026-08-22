"use client";

import { Search, X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SearchQueryForm({ initialQuery, compact = false }: { initialQuery: string; compact?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.replace(value ? `/search?q=${encodeURIComponent(value)}` : "/search", { scroll: false });
  }

  function clearSearch() {
    setQuery("");
    router.replace("/search", { scroll: false });
    inputRef.current?.focus();
  }

  return <form className={`flex flex-wrap gap-3 ${compact ? "flex-1" : "max-[480px]:flex-col"}`} onSubmit={submitSearch}>
    <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-line bg-well px-4 py-2.5 focus-within:border-ink">
      <Search className="h-4 w-4 flex-none text-muted" strokeWidth={1.8} aria-hidden="true" />
      <input
        className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search movies and TV shows…"
        ref={inputRef}
        type="text"
        value={query}
      />
      {query ? <button aria-label="Clear search" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted hover:bg-line hover:text-ink" onClick={clearSearch} type="button">
        <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </button> : null}
    </div>
    {compact
      ? <button aria-label="Submit search" className="sr-only" type="submit">Search</button>
      : <button className="min-h-12 rounded-full bg-ink px-5 py-2.5 text-base font-semibold text-bg max-[480px]:w-full" type="submit">Search</button>}
  </form>;
}
