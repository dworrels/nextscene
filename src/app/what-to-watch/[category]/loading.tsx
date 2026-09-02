import { BackButton } from "@/components/back-button";
import { GridSkeleton } from "@/components/skeletons";
import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/what-to-watch" ariaLabel="Back to What to Watch" mode="parent" />
    </section>
    <section className="page-width">
      <GridSkeleton />
    </section>
  </main>;
}
