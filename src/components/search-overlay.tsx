"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BROWSE_CATEGORIES } from "@/lib/browse-categories";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return <div className="fixed inset-0 z-[200] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Search" ref={dialogRef}>
    <div className="page-width sticky top-0 z-10 flex items-center gap-4 bg-bg pb-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <form className="flex flex-1 items-center gap-3 rounded-full border border-line bg-soft px-5 py-3 focus-within:border-ink" onSubmit={submitSearch}>
        <Search className="h-4 w-4 flex-none text-muted" strokeWidth={1.8} aria-hidden="true" />
        <input
          className="w-full bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search movies and TV shows…"
          ref={inputRef}
          type="text"
          value={query}
        />
        {query ? <button aria-label="Clear search" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted hover:bg-line hover:text-ink" onClick={() => setQuery("")} type="button">
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button> : null}
      </form>
      <button aria-label="Close search" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-soft text-ink hover:bg-line" onClick={onClose}>
        <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>

    <div className="page-width pb-24">
      <h2 className="m-0 mb-4 text-lg font-semibold text-ink">Browse</h2>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[760px]:grid-cols-4">
        {BROWSE_CATEGORIES.map((category) => <Link
          className={`group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-center transition-transform duration-200 ease-out hover:scale-[1.02] ${category.gradient}`}
          href={`/browse/${category.key}`}
          key={category.key}
        >
          <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
          <span className="relative text-xl font-bold leading-tight text-white drop-shadow-sm">{category.label}</span>
        </Link>)}
      </div>
    </div>
  </div>;
}
