import Image from "next/image";
import Link from "next/link";
import type { MediaItem } from "@/types/tmdb";

export function FilmCard({ movie, badge, predictedBadge, fluid = false }: { movie: MediaItem; badge?: string; predictedBadge?: string; fluid?: boolean }) {
  const href = movie.mediaType === "tv" ? `/tv/${movie.id}` : `/movies/${movie.id}`;
  const widthClass = fluid ? "w-full" : "w-[148px] flex-none min-[1200px]:w-[168px]";
  const posterClass = fluid ? "aspect-[2/3] w-full" : "h-[222px] w-[148px] min-[1200px]:h-[252px] min-[1200px]:w-[168px]";

  return <Link className={`group relative block ${widthClass}`} href={href} aria-label={`${movie.title} (${movie.year})`} prefetch={false}>
    <div className={`relative ${posterClass} overflow-hidden rounded-xl bg-soft transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:shadow-[0_16px_32px_rgba(0,0,0,.4)]`}>
      {movie.posterUrl ? <Image alt="" className="object-cover" fill loading="lazy" sizes={fluid ? "(max-width: 479px) 46vw, (max-width: 759px) 30vw, 148px" : "(min-width: 1200px) 168px, 148px"} src={movie.posterUrl} /> : <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,var(--color-soft),var(--color-line))] p-4 text-center text-sm font-semibold leading-snug text-muted">{movie.title}</div>}
    </div>
    {badge ? <span className="absolute left-2 top-2 whitespace-pre-line rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-white backdrop-blur-sm">{badge}</span> : null}
    {predictedBadge ? <span className="absolute left-2 top-2 inline-flex rounded-full bg-[#0057B8]/90 px-3 py-1.5 text-white shadow-[0_6px_18px_rgba(0,72,150,.38)] ring-1 ring-white/35 backdrop-blur-md" title="Predicted rating for you">
      <span className="text-[13px] font-bold tabular-nums">{predictedBadge}</span>
    </span> : null}
  </Link>;
}
