"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";

type Theme = "light" | "dark";

export function SiteHeader() {
  const [theme, setTheme] = useState<Theme>("dark");

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

  return <AppHeader theme={theme} onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />;
}
