"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilmCard } from "@/components/film-card";
import { semanticSearchAction, type SemanticSearchState } from "@/lib/semantic-search-actions";

const QUERY_PARAM = "ask";

const initialState: SemanticSearchState = { status: "idle", results: [] };
// Each one demonstrates a different kind of request the system actually
// understands (see search-intent.ts): a mood, a referenced title, a media
// type + recency combo, a runtime constraint, and a personalized shuffle —
// not just a grab-bag of examples.
const moodSuggestions = [
  "Dark mystery",
  "Something like Interstellar",
  "Great recent TV",
  "Under 2 hours",
  "Surprise me",
];

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
  const [visibleCount, setVisibleCount] = useState(24);
  const restoredRef = useRef(false);

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
    const value = String(formData.get("query") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(QUERY_PARAM, value); else params.delete(QUERY_PARAM);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    formAction(formData);
  }

  return <div>
    <form className="flex flex-wrap gap-3 max-[480px]:flex-col" action={runSearch}>
      <input
        className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-well px-4 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none focus:border-ink max-[480px]:w-full"
        name="query"
        placeholder="e.g. a dark mystery with a big twist, or a recent show I'd probably rate highly"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <SubmitButton />
    </form>
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Mood suggestions">
      {moodSuggestions.map((suggestion) => <button
        className="min-h-11 rounded-full bg-well/70 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-well hover:text-ink"
        key={suggestion}
        onClick={() => setQuery(suggestion)}
        type="button"
      >
        {suggestion}
      </button>)}
    </div>
    {state.status === "error" ? <p className="mt-3 text-xs text-danger" role="alert">{state.message}</p> : null}
    {state.appliedFilters && state.appliedFilters.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Understood as">
      {state.appliedFilters.map((filter) => <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-muted" key={filter}>{filter}</span>)}
    </div> : null}
    {state.weakMatch ? <p className="mt-3 text-xs text-muted">Matches for this query were weaker than usual — try rephrasing or being more specific.</p> : null}
    {state.results.length > 0 ? <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] min-[760px]:gap-4">
        {state.results.slice(0, visibleCount).map(({ item, predictedRating, predictedConfidence }) => <FilmCard
          fluid
          key={`${item.mediaType}-${item.id}`}
          movie={item}
          predictedBadge={predictedRating !== null && predictedConfidence !== "low" ? predictedRating.toFixed(1) : undefined}
        />)}
      </div>
      {visibleCount < state.results.length ? <button className="mt-6 min-h-11 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-soft" onClick={() => setVisibleCount((count) => count + 24)} type="button">Show more</button> : null}
    </div> : null}
  </div>;
}
