"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { SearchOverlay } from "@/components/search-overlay";

type Theme = "light" | "dark";

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

  return <>
    <AppHeader theme={theme} onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")} onSearchOpen={() => setSearchOpen(true)} />
    {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
  </>;
}
