import Link from "next/link";
import { FilmCard } from "@/components/film-card";
import { Arrow } from "@/components/icons";
import type { UpcomingMovie } from "@/types/tmdb";

function releaseDateLabel(date: string) {
  if (!date) return "TBA";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(`${date}T12:00:00`)).toUpperCase();
}

export function ReleaseTracker({ movies }: { movies: UpcomingMovie[] }) {
  if (movies.length === 0) return null;

  return <section className="page-width pt-14 max-[760px]:pt-9 pb-[72px] max-[760px]:pb-[50px]">
    <h2 className="m-0 mb-[18px] text-[22px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:mb-3.5 max-[760px]:text-[19px]">
      <Link className="inline-flex items-center gap-1.5 hover:opacity-70" href="/browse/coming-soon">Coming Soon <Arrow /></Link>
    </h2>
    <div className="flex gap-3 overflow-x-auto pb-1 -mr-4 pr-4 [scrollbar-width:none]">
      {movies.slice(0, 12).map((movie) => <FilmCard movie={movie} badge={releaseDateLabel(movie.releaseDate)} key={movie.id} />)}
    </div>
  </section>;
}
