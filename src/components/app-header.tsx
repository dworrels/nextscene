import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { Mark } from "@/components/icons";

type Theme = "light" | "dark";

export function AppHeader({ theme, onThemeToggle }: { theme: Theme; onThemeToggle: () => void }) {
  const isDark = theme === "dark";

  return <header className="page-width flex h-16 max-[760px]:h-14 items-center justify-between gap-[30px] max-[760px]:gap-[10px] bg-bg">
    <Link className="inline-flex items-center gap-[7px] whitespace-nowrap text-base font-semibold tracking-[-0.02em] text-ink" href="/" aria-label="NextScene home">
      <Mark /> <span>NextScene</span>
    </Link>
    <nav className="ml-auto mr-3 flex gap-6 max-[760px]:hidden" aria-label="Primary navigation">
      <a className="text-xs font-medium text-ink" href="/discover">Discover</a>
      <a className="text-xs font-medium text-muted hover:text-ink" href="#for-you">Movies</a>
      <a className="text-xs font-medium text-muted hover:text-ink" href="#up-next">Coming soon</a>
    </nav>
    <div className="flex items-center gap-2.5 max-[760px]:ml-auto">
      <button
        className="grid h-[30px] w-[30px] place-items-center rounded-full border-0 bg-transparent text-ink hover:bg-soft"
        onClick={onThemeToggle}
        aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      >
        {isDark ? <Sun className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> : <Moon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </div>
  </header>;
}
