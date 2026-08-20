import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { ContentPreferencesForm } from "@/components/content-preferences-form";
import { SiteHeader } from "@/components/site-header";
import { readContentPreferences } from "@/lib/content-preferences";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preferences — NextScene" };

export default async function PreferencesPage() {
  const preferences = await readContentPreferences();
  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width max-w-[720px] pt-[84px] max-[760px]:pt-11">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Preferences</h1>
      <p className="mt-4 max-w-[560px] text-sm text-muted">Set gentle defaults that shape ordering across browse, search, related titles, and personal recommendations.</p>
      <div className="mt-8"><ContentPreferencesForm preferEnglishOriginalLanguage={preferences.preferEnglishOriginalLanguage} /></div>
    </section>
  </main>;
}
