import { FilmCard } from "@/components/film-card";
import type { MediaItem } from "@/types/tmdb";

export function MovieGrid({ movies, predictedBadges }: { movies: MediaItem[]; predictedBadges?: Record<string, string> }) {
  return <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] min-[760px]:gap-4">
    {movies.map((movie) => {
      const key = `${movie.mediaType}-${movie.id}`;
      return <FilmCard movie={movie} predictedBadge={predictedBadges?.[key]} fluid key={key} />;
    })}
  </div>;
}
