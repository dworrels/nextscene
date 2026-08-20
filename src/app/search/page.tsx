import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SiteHeader } from "@/components/site-header";
import { getInitialSearchMedia, searchMediaPage } from "@/lib/browse-actions";

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
  const results = query ? await getInitialSearchMedia(query).catch(() => null) : null;

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Search</h1>
      {results ? <p className="mt-4 text-sm text-muted">{results.totalResults.toLocaleString()} titles found for &ldquo;{query}&rdquo;.</p> : null}
    </section>

    {query ? <section className="page-width">
      {!results
        ? <CatalogError />
        : results.items.length > 0
          ? <PaginatedGrid initialPage={results} loadMore={searchMediaPage.bind(null, query)} />
          : <p className="text-sm text-muted">No movies or TV shows found.</p>}
    </section> : null}
  </main>;
}
