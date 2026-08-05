import { FilmCard } from "@/components/film-card";
import type { Movie } from "@/types/tmdb";

export function MovieGrid({ movies }: { movies: Movie[] }) {
  return <div className="page-width grid grid-cols-4 gap-4 pb-24 max-[760px]:grid-cols-2 max-[760px]:gap-[13px] max-[760px]:pb-12">
    {movies.map((movie) => <FilmCard movie={movie} key={movie.id} />)}
  </div>;
}
