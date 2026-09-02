"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilmCard } from "@/components/film-card";
import { semanticSearchAction, type SemanticSearchState } from "@/lib/semantic-search-actions";

const QUERY_PARAM = "ask";
const VISIBLE_COUNT_STORAGE_PREFIX = "nextscene-ask-visible:";
const RESULTS_STORAGE_PREFIX = "nextscene-ask-results:";
const RESULTS_TTL_MS = 30 * 60 * 1000;

const initialState: SemanticSearchState = { status: "idle", results: [] };

function readCachedState(query: string): Pick<SemanticSearchState, "results" | "appliedFilters" | "weakMatch" | "noResults"> {
  if (!query || typeof window === "undefined") return { results: [] };
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(`${RESULTS_STORAGE_PREFIX}${query}`) ?? "null") as (Pick<SemanticSearchState, "results" | "appliedFilters" | "weakMatch" | "noResults"> & { savedAt?: number }) | null;
    if (saved && typeof saved.savedAt === "number" && Date.now() - saved.savedAt < RESULTS_TTL_MS && Array.isArray(saved.results)) return saved;
  } catch {
    // Ignore malformed session state and restore from the server action.
  }
  return { results: [] };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-11 flex-none rounded-full bg-ink px-5 py-2.5 text-base font-semibold text-bg disabled:opacity-60 max-[480px]:w-full" disabled={pending} type="submit">
    {pending ? "Finding…" : "Find something"}
  </button>;
}

export function SemanticSearch() {
  const [state, formAction] = useActionState(semanticSearchAction, initialState);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialQuery = searchParams.get(QUERY_PARAM) ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(() => {
    if (!initialQuery || typeof window === "undefined") return 24;
    const saved = Number(window.sessionStorage.getItem(`${VISIBLE_COUNT_STORAGE_PREFIX}${initialQuery}`));
    return Number.isInteger(saved) && saved >= 24 ? saved : 24;
  });
  const [cachedState, setCachedState] = useState(() => readCachedState(initialQuery));
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!initialQuery || state.results.length === 0) return;
    window.sessionStorage.setItem(`${VISIBLE_COUNT_STORAGE_PREFIX}${initialQuery}`, String(visibleCount));
    window.sessionStorage.setItem(`${RESULTS_STORAGE_PREFIX}${initialQuery}`, JSON.stringify({
      results: state.results,
      appliedFilters: state.appliedFilters,
      weakMatch: state.weakMatch,
      savedAt: Date.now(),
    }));
  }, [initialQuery, state.appliedFilters, state.results, state.weakMatch, visibleCount]);

  // Clicking into a result and hitting back returns to this page with its
  // results gone — a fresh client-side mount starts from empty state again.
  // Keeping the query in the URL means the browser history entry itself
  // carries it, so this runs once on that fresh mount and reconstructs the
  // same results instead of leaving the search looking cleared out.
  useEffect(() => {
    if (restoredRef.current || !initialQuery) return;
    restoredRef.current = true;
    const formData = new FormData();
    formData.set("query", initialQuery);
    // formAction is only safe to call directly from a form's action/formAction
    // prop (which wraps it in a transition automatically) or from inside an
    // explicit transition — calling it bare from an effect leaves `pending`
    // (useFormStatus) unable to track it correctly.
    startTransition(() => formAction(formData));
    // Restoring only needs to happen once, from whatever `ask` the URL had
    // on first mount — not every time formAction's identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(formData: FormData) {
    setVisibleCount(24);
    setCachedState({ results: [] });
    const value = String(formData.get("query") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(QUERY_PARAM, value); else params.delete(QUERY_PARAM);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    formAction(formData);
  }

  function clearSearch() {
    setQuery("");
    setVisibleCount(24);
    setCachedState({ results: [] });
    const params = new URLSearchParams(searchParams.toString());
    params.delete(QUERY_PARAM);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    const formData = new FormData();
    startTransition(() => formAction(formData));
  }

  const results = state.results.length > 0 ? state.results : cachedState.results;
  const appliedFilters = state.appliedFilters ?? cachedState.appliedFilters;
  const weakMatch = state.weakMatch ?? cachedState.weakMatch;
  const noResults = state.noResults ?? cachedState.noResults;

  return <div>
    <form className="flex flex-wrap gap-3 max-[480px]:flex-col" action={runSearch}>
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-line bg-well px-4 py-2.5 focus-within:border-ink max-[480px]:w-full">
        <input
          className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          name="query"
          placeholder="e.g. a dark mystery with a big twist, or a recent show I'd probably rate highly"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query || results.length > 0 ? <button aria-label="Clear question and results" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted hover:bg-line hover:text-ink" onClick={clearSearch} type="button">
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button> : null}
      </div>
      <SubmitButton />
    </form>
    {state.status === "error" ? <p className="mt-3 text-xs text-danger" role="alert">{state.message}</p> : null}
    {appliedFilters && appliedFilters.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Understood as">
      {appliedFilters.map((filter) => <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-muted" key={filter}>{filter}</span>)}
    </div> : null}
    {noResults ? <p className="mt-3 text-xs text-muted">Nothing matched every filter in that request — try dropping one, like the runtime or streaming service.</p> : null}
    {weakMatch ? <p className="mt-3 text-xs text-muted">Matches for this query were weaker than usual — try rephrasing or being more specific.</p> : null}
    {results.length > 0 ? <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] min-[760px]:gap-4">
        {results.slice(0, visibleCount).map(({ item, predictedRating, predictedConfidence }) => <FilmCard
          fluid
          key={`${item.mediaType}-${item.id}`}
          movie={item}
          predictedBadge={predictedRating !== null && predictedConfidence !== "low" ? predictedRating.toFixed(1) : undefined}
        />)}
      </div>
      {visibleCount < results.length ? <button className="mt-6 min-h-11 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-soft" onClick={() => setVisibleCount((count) => count + 24)} type="button">Show more</button> : null}
    </div> : null}
  </div>;
}
