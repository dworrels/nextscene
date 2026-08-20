import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { ProgressiveMovieGrid } from "@/components/progressive-movie-grid";
import { SiteHeader } from "@/components/site-header";
import { PROFILE_CATEGORIES } from "@/lib/recommendation-selection";
import { getWhatToWatchCategory } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

function findCategory(key: string) {
  return PROFILE_CATEGORIES.find((category) => category.key === key);
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: categoryKey } = await params;
  const category = findCategory(categoryKey);
  return category ? { title: `${category.title} — NextScene` } : {};
}

export default async function WhatToWatchCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categoryKey } = await params;
  const category = findCategory(categoryKey);
  if (!category) notFound();

  const rail = await getWhatToWatchCategory(category.key).catch(() => undefined);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/what-to-watch" ariaLabel="Back to What to Watch" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">{category.title}</h1>
      {rail?.items.length ? <p className="mt-4 text-sm text-muted">{rail.items.length} personalized title{rail.items.length === 1 ? "" : "s"}.</p> : null}
    </section>

    <section className="page-width">
      {rail === undefined
        ? <CatalogError />
        : rail === null
          ? <p className="text-sm text-muted">Import ratings to build this category.</p>
          : rail.items.length > 0
            ? <ProgressiveMovieGrid items={rail.items} predictedBadges={rail.predictedBadges} />
            : <p className="text-sm text-muted">No additional titles are available in this category right now.</p>}
    </section>
  </main>;
}
