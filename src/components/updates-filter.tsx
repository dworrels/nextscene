"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type FilterOption = { slug: string; title: string; count: number };

export function UpdatesFilter({ options, value }: { options: FilterOption[]; value: string }) {
  const router = useRouter();

  return <div className="mb-6 min-[760px]:hidden">
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.04em] text-muted" htmlFor="updates-filter">Update category</label>
    <div className="relative">
      <select
        className="min-h-11 w-full appearance-none rounded-xl border border-line bg-soft py-2 pl-3 pr-10 text-sm font-semibold text-ink outline-none focus:border-ink"
        id="updates-filter"
        value={value}
        onChange={(event) => router.replace(`/updates?tab=${encodeURIComponent(event.target.value)}`, { scroll: false })}
      >
        {options.map((option) => <option key={option.slug} value={option.slug}>{option.title} ({option.count})</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.8} aria-hidden="true" />
    </div>
  </div>;
}