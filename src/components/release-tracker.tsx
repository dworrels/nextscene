import { FilmCard } from "@/components/film-card";
import type { UpcomingMovie } from "@/types/tmdb";

function releaseDateLabel(date: string) {
  if (!date) return "TBA";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(`${date}T12:00:00`)).toUpperCase();
}

export function ReleaseTracker({ movies }: { movies: UpcomingMovie[] }) {
  return <section className="page-width pt-20 max-[760px]:pt-[52px] pb-[72px] max-[760px]:pb-[50px]" id="up-next">
    <div className="mb-[22px] flex items-end justify-between gap-5 max-[760px]:mb-[19px] max-[760px]:items-center">
      <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]">Coming Soon</h2>
    </div>
    <div className="grid grid-cols-4 gap-[14px] max-[760px]:flex max-[760px]:gap-[13px] max-[760px]:-mr-4 max-[760px]:overflow-x-auto max-[760px]:pr-4 max-[760px]:[scrollbar-width:none]">
      {movies.map((movie) => <FilmCard
        movie={movie}
        badge={releaseDateLabel(movie.releaseDate)}
        meta={movie.certification ?? undefined}
        key={movie.id}
      />)}
    </div>
  </section>;
}
