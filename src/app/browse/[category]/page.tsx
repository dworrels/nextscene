import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { browseCategory, getInitialBrowseCategory } from "@/lib/browse-actions";
import { BROWSE_CATEGORIES } from "@/lib/browse-categories";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: categoryKey } = await params;
  const category = BROWSE_CATEGORIES.find((entry) => entry.key === categoryKey);
  if (!category) return {};

  return { title: `${category.label} — NextScene` };
}

export default async function BrowseCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categoryKey } = await params;
  const category = BROWSE_CATEGORIES.find((entry) => entry.key === categoryKey);
  if (!category) notFound();

  const items = await getInitialBrowseCategory(categoryKey).catch(() => null);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">{category.label}</h1>
    </section>

    <section className="page-width">
      {items === null
        ? <CatalogError />
        : items.items.length > 0
          ? <PaginatedGrid initialPage={items} loadMore={browseCategory.bind(null, categoryKey)} />
          : <p className="text-sm text-muted">No titles found in this category right now.</p>}
    </section>
  </main>;
}
