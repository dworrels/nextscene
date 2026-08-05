import { FilmCard } from "@/components/film-card";
import { Arrow } from "@/components/icons";
import type { Movie } from "@/types/tmdb";

export function MovieRail({ movies }: { movies: Movie[] }) {
  return <section className="page-width pt-20 max-[760px]:pt-[52px]" id="for-you">
    <div className="mb-[22px] flex items-end justify-between gap-5 max-[760px]:mb-[19px] max-[760px]:items-center">
      <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]">Popular</h2>
      <a className="flex-none inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink max-[760px]:text-[11px]" href="/discover">View all <Arrow /></a>
    </div>
    <div className="grid grid-cols-4 gap-[14px] max-[760px]:flex max-[760px]:gap-[13px] max-[760px]:-mr-4 max-[760px]:overflow-x-auto max-[760px]:pr-4 max-[760px]:[scrollbar-width:none]">
      {movies.map((movie) => <FilmCard movie={movie} key={movie.id} />)}
    </div>
  </section>;
}
