import { Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { Mark } from "@/components/icons";

type Theme = "light" | "dark";

export function AppHeader({ theme, onThemeToggle, onSearchOpen }: { theme: Theme; onThemeToggle: () => void; onSearchOpen: () => void }) {
  const isDark = theme === "dark";

  return <header className="page-width flex h-16 max-[760px]:h-14 items-center justify-between gap-[30px] max-[760px]:gap-[10px] bg-bg">
    <Link className="inline-flex items-center gap-[7px] whitespace-nowrap text-base font-semibold tracking-[-0.02em] text-ink" href="/" aria-label="NextScene home">
      <Mark /> <span>NextScene</span>
    </Link>
    <button
      className="ml-auto flex w-full max-w-[320px] items-center gap-2.5 rounded-full border border-line bg-soft px-4 py-2 text-left text-sm text-muted hover:text-ink max-[760px]:max-w-none"
      onClick={onSearchOpen}
    >
      <Search className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden="true" />
      <span className="truncate">Search movies and TV shows…</span>
    </button>
    <div className="flex items-center gap-2.5">
      <button
        className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-soft"
        onClick={onThemeToggle}
        aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      >
        {isDark ? <Sun className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> : <Moon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </div>
  </header>;
}
