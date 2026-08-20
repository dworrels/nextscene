import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/types/tmdb";

export function MovieHero({ movie }: { movie: Movie }) {
  return <section className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[480px] max-[480px]:min-h-[420px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]" id="top">
    {movie.backdropUrl ? <Image alt="" className="-z-[2] object-cover object-center saturate-[85%] contrast-[98%] max-[760px]:object-[59%_center]" fill preload sizes="(max-width: 760px) 100vw, min(1440px, calc(100vw - 80px))" src={movie.backdropUrl} /> : null}
    <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
    <div className="max-w-[560px] max-[760px]:max-w-none px-10 pb-16 max-[760px]:px-6 max-[760px]:pb-9 max-[480px]:px-4 max-[480px]:pb-7">
      <h1 className="m-0 text-[clamp(50px,6.2vw,96px)] max-[760px]:text-[44px] max-[480px]:text-[34px] font-bold leading-[0.94] max-[760px]:leading-[1.04] tracking-[-0.02em] text-white break-words">{movie.title}</h1>
      <div className="my-5 max-[760px]:my-3.5 flex flex-wrap items-center gap-3 text-[13px] font-medium text-white/85"><span>{movie.year}</span><span>{movie.genre}</span><span>{movie.audienceScore}% TMDb score</span></div>
      <p className="mb-7 max-[760px]:mb-5 max-w-[500px] text-base leading-[1.5] text-white/90 max-[480px]:line-clamp-3">{movie.overview}</p>
      <div className="flex gap-3">
        <Link className="inline-flex min-h-[46px] items-center gap-2 rounded-full border-0 bg-white px-6 text-sm font-semibold text-[#151513]" href={`/movies/${movie.id}`}>
          View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  </section>;
}
