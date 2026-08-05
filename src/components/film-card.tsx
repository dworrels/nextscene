import type { Movie } from "@/types/tmdb";

export function FilmCard({ movie, badge, meta }: { movie: Movie; badge?: string; meta?: string }) {
  return <article className="max-[760px]:flex-[0_0_240px]">
    <a className="group relative block" href={`/movies/${movie.id}`} aria-label={`View ${movie.title}`}>
      <div className="rounded-xl transition-transform duration-300 ease-out group-hover:scale-[1.03] group-hover:shadow-[0_20px_40px_rgba(0,0,0,.45)]">
        <div className="aspect-video overflow-hidden rounded-xl bg-soft">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${movie.backdropUrl ?? movie.posterUrl})` }} />
        </div>
      </div>
      {badge ? <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-white backdrop-blur-sm">{badge}</span> : null}
    </a>
    <div className="mt-3">
      <h3 className="m-0 truncate text-sm font-semibold tracking-[-0.01em] text-ink">{movie.title}</h3>
      <p className="mt-1 truncate text-xs text-muted">{movie.year} · {movie.genre}</p>
      {meta ? <p className="mt-0.5 truncate text-xs text-muted">{meta}</p> : null}
    </div>
  </article>;
}
