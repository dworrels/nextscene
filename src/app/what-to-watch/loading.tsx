import { BackButton } from "@/components/back-button";
import { RailSkeleton } from "@/components/skeletons";
import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">What to Watch</h1>
    </section>
    <section className="page-width pb-10" aria-hidden="true">
      <div className="h-[220px] animate-pulse rounded-2xl bg-soft max-[760px]:h-[260px]" />
    </section>
    <RailSkeleton />
    <RailSkeleton />
    <RailSkeleton />
  </main>;
}
