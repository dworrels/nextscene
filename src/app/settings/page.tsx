import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, SlidersHorizontal } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Settings — NextScene" };

const SETTINGS_SECTIONS = [
  { href: "/settings/preferences", title: "Preferences", description: "Gentle defaults that shape ordering across browse, search, and recommendations.", icon: SlidersHorizontal },
  { href: "/settings/lists", title: "Lists", description: "Replace or delete your imported ratings and watchlist.", icon: ListChecks },
] as const;

export default function SettingsPage() {
  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width max-w-[720px] pt-[84px] max-[760px]:pt-11">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Settings</h1>

      <div className="mt-8 flex flex-col gap-3">
        {SETTINGS_SECTIONS.map(({ href, title, description, icon: Icon }) => <Link
          className="flex items-center gap-4 rounded-2xl border border-line bg-soft p-5 transition-colors hover:bg-well"
          href={href}
          key={href}
        >
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-well text-ink">
            <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold text-ink">{title}</span>
            <span className="block mt-0.5 text-sm text-muted">{description}</span>
          </span>
        </Link>)}
      </div>
    </section>
  </main>;
}
