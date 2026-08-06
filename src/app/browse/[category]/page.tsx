import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { browseCategory } from "@/lib/browse-actions";
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

  const items = await browseCategory(categoryKey, 1);

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <Link className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink" href="/"><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to home</Link>
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">{category.label}</h1>
    </section>

    <section className="page-width">
      <PaginatedGrid initialPage={items} loadMore={browseCategory.bind(null, categoryKey)} />
    </section>
  </main>;
}
