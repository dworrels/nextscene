import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { searchMediaPage } from "@/lib/browse-actions";

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

function queryValue(searchParams: SearchParams) {
  const value = searchParams.q;
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const query = queryValue(await searchParams);
  return { title: query ? `Search: ${query} — NextScene` : "Search — NextScene" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = queryValue(await searchParams);
  const results = query ? await searchMediaPage(query, 1) : null;

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <Link className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink" href="/"><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to home</Link>
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Search</h1>
      {results ? <p className="mt-4 text-sm text-muted">{results.totalResults.toLocaleString()} titles found for &ldquo;{query}&rdquo;.</p> : null}
    </section>

    {results ? <section className="page-width">
      {results.items.length > 0 ? <PaginatedGrid initialPage={results} loadMore={searchMediaPage.bind(null, query)} /> : <p className="text-sm text-muted">No movies or TV shows found.</p>}
    </section> : null}
  </main>;
}
