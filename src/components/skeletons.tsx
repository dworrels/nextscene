import { SiteHeader } from "@/components/site-header";

// Shared building blocks for route-level loading.tsx files. These exist
// purely to fill the screen while a page's async data-fetching resolves —
// Next shows them automatically via the App Router's built-in Suspense
// boundary, so none of this touches the actual data-fetching logic.

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return <section className="page-width pt-14 max-[760px]:pt-9" aria-hidden="true">
    <div className="mb-[18px] h-[22px] w-48 animate-pulse rounded-lg bg-soft max-[760px]:mb-3.5" />
    <div className="flex gap-3 overflow-x-auto pb-1 -mr-10 pr-10 max-[760px]:-mr-6 max-[760px]:pr-6 max-[480px]:-mr-4 max-[480px]:pr-4 [scrollbar-width:none]">
      {Array.from({ length: count }, (_, index) => <div className="h-[222px] w-[148px] flex-none animate-pulse rounded-xl bg-soft" key={index} />)}
    </div>
  </section>;
}

export function GridSkeleton({ count = 24 }: { count?: number }) {
  return <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] min-[760px]:gap-4" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-soft" key={index} />)}
  </div>;
}

export function DetailPageSkeleton() {
  return <main className="pb-24">
    <SiteHeader />
    <div className="page-width" aria-hidden="true">
      <div className="min-h-[min(660px,76vh)] max-[760px]:min-h-[480px] max-[480px]:min-h-[420px] animate-pulse rounded-[18px] max-[760px]:rounded-[11px] bg-soft" />
    </div>

    <section className="page-width mt-6 max-[760px]:mt-5" aria-hidden="true">
      <div className="animate-pulse rounded-2xl border border-line bg-soft p-6 max-[480px]:p-5">
        <div className="h-4 w-40 rounded bg-well" />
        <div className="mt-3 h-4 w-56 rounded bg-well" />
        <div className="mt-5 h-6 w-72 rounded bg-well" />
        <div className="mt-4 h-4 w-full max-w-[620px] rounded bg-well" />
        <div className="mt-2 h-4 w-full max-w-[560px] rounded bg-well" />
      </div>
    </section>

    <section className="page-width mt-10" aria-hidden="true">
      <div className="animate-pulse rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
        <div className="h-5 w-64 rounded bg-well" />
        <div className="mt-4 h-24 rounded-2xl bg-well" />
        <div className="mt-2.5 h-32 rounded-2xl bg-well" />
      </div>
    </section>
  </main>;
}
