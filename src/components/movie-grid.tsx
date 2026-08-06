import { FilmCard } from "@/components/film-card";
import type { MediaItem } from "@/types/tmdb";

export function MovieGrid({ movies }: { movies: MediaItem[] }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 min-[760px]:gap-4">
    {movies.map((movie) => <FilmCard movie={movie} key={`${movie.mediaType}-${movie.id}`} />)}
  </div>;
}
