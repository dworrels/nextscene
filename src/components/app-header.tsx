"use client";

import { CircleUser, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return <div className="relative flex-none justify-self-center" ref={containerRef}>
    <button
      className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-soft"
      onClick={() => setOpen((current) => !current)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Profile menu"
    >
      <CircleUser className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
    </button>
    {open ? <div className="absolute left-1/2 top-[calc(100%+10px)] z-20 w-60 -translate-x-1/2 rounded-2xl border border-line bg-bg p-2 shadow-[0_16px_32px_rgba(0,0,0,.16)]" role="menu">
      <Link className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-soft" href="/what-to-watch" role="menuitem" onClick={() => setOpen(false)}>What to Watch</Link>
      <Link className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-soft" href="/ratings" role="menuitem" onClick={() => setOpen(false)}>Ratings</Link>
      <Link className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-soft" href="/watchlist" role="menuitem" onClick={() => setOpen(false)}>Watchlist</Link>
      <Link className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-soft" href="/updates" role="menuitem" onClick={() => setOpen(false)}>Updates</Link>
      <Link className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-medium text-ink hover:bg-soft" href="/settings" role="menuitem" onClick={() => setOpen(false)}>Settings</Link>
    </div> : null}
  </div>;
}

export function AppHeader({ theme, onThemeToggle, onSearchOpen, showSearch = true }: { theme: Theme; onThemeToggle: () => void; onSearchOpen: () => void; showSearch?: boolean }) {
  const isDark = theme === "dark";

  return <div className="bg-bg">
    <header className="page-width grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2.5 max-[760px]:h-14 max-[480px]:gap-1.5">
      <div className="flex min-w-0 items-center">
        <Link className="inline-flex flex-none items-center whitespace-nowrap text-base font-semibold tracking-[-0.02em] text-ink" href="/" aria-label="NextScene home">
          <span>NextScene</span>
        </Link>
      </div>
      <ProfileMenu />
      <div className="flex min-w-0 items-center justify-end gap-2.5 max-[480px]:gap-1.5">
        {showSearch ? <button
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-soft px-4 py-2 text-left text-sm text-muted hover:text-ink max-w-[260px] max-[760px]:max-w-none max-[480px]:hidden"
          onClick={onSearchOpen}
        >
          <Search className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden="true" />
          <span className="truncate">Search movies and TV shows…</span>
        </button> : null}
        <button
          className="grid h-11 w-11 flex-none place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-soft"
          onClick={onThemeToggle}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
          {isDark ? <Sun className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> : <Moon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
        </button>
      </div>
    </header>
    {/* Below 480px the pill can't fit alongside the theme toggle without
        losing its "bar" identity, so it moves to a dedicated full-width row
        instead of collapsing to a bare icon indistinguishable from the
        profile/theme buttons. */}
    <div className="page-width hidden pb-3 max-[480px]:block">
      {showSearch ? <button
        className="flex h-11 w-full items-center gap-2.5 rounded-full border border-line bg-soft px-4 text-left text-sm text-muted hover:text-ink"
        onClick={onSearchOpen}
      >
        <Search className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden="true" />
        <span className="truncate">Search movies and TV shows…</span>
      </button> : null}
    </div>
  </div>;
}
