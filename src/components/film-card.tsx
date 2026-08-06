import type { MediaItem } from "@/types/tmdb";

export function FilmCard({ movie, badge }: { movie: MediaItem; badge?: string }) {
  const href = movie.mediaType === "tv" ? `/tv/${movie.id}` : `/movies/${movie.id}`;

  return <a className="group relative block w-[148px] flex-none" href={href} aria-label={`${movie.title} (${movie.year})`}>
    <div className="h-[222px] w-[148px] overflow-hidden rounded-xl bg-soft transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:shadow-[0_16px_32px_rgba(0,0,0,.4)]">
      <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${movie.posterUrl})` }} />
    </div>
    {badge ? <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-white backdrop-blur-sm">{badge}</span> : null}
  </a>;
}
