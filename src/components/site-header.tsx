"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { SearchOverlay } from "@/components/search-overlay";

type Theme = "light" | "dark";

// This overlay lives inside SiteHeader, which every page renders its own
// copy of — so navigating to a result and back remounts a fresh SiteHeader
// with no memory of the overlay having been open. Persisting to
// sessionStorage (checked after mount, not during initial render, so SSR and
// the first client render match and hydration doesn't warn) restores it.
const SEARCH_OPEN_KEY = "nextscene-search-open";
const SEARCH_QUERY_KEY = "nextscene-search-query";

export function SiteHeader() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    const frame = window.requestAnimationFrame(() => {
      if (current === "light" || current === "dark") setTheme(current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("nextscene-theme", theme);
  }, [theme]);

  useEffect(() => {
    // Deliberately deferred to an effect rather than a useState lazy
    // initializer: reading sessionStorage during the initial render would
    // make the client's first render diverge from the server-rendered HTML
    // (which always has no search state to read) and fail hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.sessionStorage.getItem(SEARCH_OPEN_KEY) === "1") setSearchOpen(true);
  }, []);

  function openSearch() {
    window.sessionStorage.setItem(SEARCH_OPEN_KEY, "1");
    setSearchOpen(true);
  }

  function closeSearch() {
    window.sessionStorage.removeItem(SEARCH_OPEN_KEY);
    window.sessionStorage.removeItem(SEARCH_QUERY_KEY);
    setSearchOpen(false);
  }

  return <>
    <AppHeader theme={theme} onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")} onSearchOpen={openSearch} />
    {searchOpen ? <SearchOverlay onClose={closeSearch} /> : null}
  </>;
}
