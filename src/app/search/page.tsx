import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { CatalogError } from "@/components/catalog-state";
import { PaginatedGrid } from "@/components/paginated-grid";
import { SearchQueryForm } from "@/components/search-query-form";
import { getInitialSearchMedia, searchMediaPage } from "@/lib/browse-actions";
import { BROWSE_CATEGORIES } from "@/lib/browse-categories";

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

  return <main className="min-h-screen overflow-y-auto bg-bg pb-24">
    <section className="sticky top-0 z-10 bg-bg pb-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="page-width flex items-center gap-4">
        <SearchQueryForm compact initialQuery={query} key={query} />
        <Link aria-label="Close search" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-soft text-ink hover:bg-line" href="/">
          <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
    </section>

    <section className="page-width">
      {query ? <>
        {results ? <p className="mb-5 text-sm text-muted">{results.totalResults.toLocaleString()} titles found for &ldquo;{query}&rdquo;.</p> : null}
        {!results
          ? <CatalogError />
          : results.items.length > 0
            ? <PaginatedGrid initialPage={results} loadMore={searchMediaPage.bind(null, query)} stateKey={`search:${query}`} />
            : <p className="text-sm text-muted">No movies or TV shows found.</p>}
      </> : <>
        <h2 className="m-0 mb-4 text-lg font-semibold text-ink">Browse</h2>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[760px]:grid-cols-4">
          {BROWSE_CATEGORIES.map((category) => <Link
            className={`group relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-center transition-transform duration-200 ease-out hover:scale-[1.02] ${category.gradient}`}
            href={`/browse/${category.key}`}
            key={category.key}
          >
            <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
            <span className="relative text-xl font-bold leading-tight text-white drop-shadow-sm">{category.label}</span>
          </Link>)}
        </div>
      </>}
    </section>
  </main>;
}
