import Link from "next/link";
import { Suspense } from "react";
import {
  HomeDiscoverySections,
  HomePersonalizedSection,
  HomePopularMoviesSection,
  HomePrimarySection,
  HomeRailSkeleton,
  HomeReleasesSection,
} from "@/components/home-sections";
import { SiteHeader } from "@/components/site-header";
import { TasteProfile } from "@/components/taste-profile";

export const revalidate = 3600;

export default function Home() {
  return <main>
    <SiteHeader />
    <Suspense fallback={<HomeRailSkeleton />}><HomePrimarySection /></Suspense>
    <Suspense fallback={<HomeRailSkeleton />}><HomePersonalizedSection /></Suspense>
    <Suspense fallback={<HomeRailSkeleton />}><HomePopularMoviesSection /></Suspense>
    <Suspense fallback={<HomeRailSkeleton />}><HomeDiscoverySections /></Suspense>
    <Suspense fallback={<HomeRailSkeleton />}><TasteProfile /></Suspense>
    <Suspense fallback={<HomeRailSkeleton />}><HomeReleasesSection /></Suspense>
    <footer className="page-width grid min-h-[155px] max-[760px]:min-h-[180px] grid-cols-[auto_1fr_auto] max-[760px]:grid-cols-1 items-start gap-[30px] max-[760px]:gap-2 border-t border-line pt-[42px] pb-6">
      <Link className="inline-flex items-center whitespace-nowrap text-base font-semibold tracking-[-0.02em]" href="/"><span>NextScene</span></Link>
      <p className="mt-[3px] text-xs text-muted">Personal recommendations, considered.</p>
      <p className="mt-[3px] max-[760px]:mt-3 max-w-[260px] text-xs leading-[1.4] text-right text-muted max-[760px]:text-left">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </footer>
  </main>;
}
