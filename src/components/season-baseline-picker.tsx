"use client";

import { useActionState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { setSeasonBaselineAction } from "@/lib/franchise-updates-actions";
import type { SeasonSummary } from "@/types/tmdb";

export function SeasonBaselinePicker({ showId, showTitle, seasons }: { showId: number; showTitle: string; seasons: SeasonSummary[] }) {
  const storageKey = `nextscene-season-baseline:${showId}`;
  const selectRef = useRef<HTMLSelectElement>(null);
  const [savedBaseline, submitBaseline] = useActionState(async (_previous: string | null, formData: FormData) => {
    await setSeasonBaselineAction(formData);
    return String(formData.get("baseline") ?? "recent");
  }, null);

  useEffect(() => {
    const value = savedBaseline ?? window.localStorage.getItem(storageKey);
    if (value && selectRef.current) selectRef.current.value = value;
  }, [savedBaseline, storageKey]);

  return <form action={submitBaseline} className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[600px]:w-full max-[600px]:justify-start">
    <input name="showId" type="hidden" value={showId} />
    <input name="showTitle" type="hidden" value={showTitle} />
    <div className="min-w-0 max-[600px]:w-full">
      <label className="mb-1 block text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-muted max-[600px]:text-left" htmlFor="baseline">Seasons watched</label>
      <div className="relative">
        <select
          className="min-h-10 max-w-full appearance-none rounded-xl border border-line bg-bg py-2 pl-3 pr-10 text-sm font-medium text-ink outline-none transition-colors focus:border-ink max-[600px]:w-full"
          id="baseline"
          name="baseline"
          ref={selectRef}
          onChange={(event) => {
            const value = event.target.value;
            window.localStorage.setItem(storageKey, value);
            event.currentTarget.form?.requestSubmit();
          }}
          defaultValue="recent"
        >
          <option value="caught_up">I&apos;ve watched every season</option>
          <option value="recent">Only show recent seasons</option>
          {seasons.map((season) => <option key={season.seasonNumber} value={`through:${season.seasonNumber}`}>Watched through Season {season.seasonNumber}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.8} aria-hidden="true" />
      </div>
    </div>
  </form>;
}
