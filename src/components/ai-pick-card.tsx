import Image from "next/image";
import Link from "next/link";
import type { MediaItem } from "@/types/tmdb";

export function AiPickCard({ item, score, reason }: { item: MediaItem; score: number; reason: string }) {
  const href = item.mediaType === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;

  return <Link className="group flex gap-4 rounded-xl border border-line bg-bg p-3 transition-colors hover:bg-soft" href={href} prefetch={false}>
    <div className="relative aspect-[0.68] w-[92px] flex-none overflow-hidden rounded-lg bg-soft">
      {item.posterUrl ? <Image alt="" className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]" fill loading="lazy" sizes="92px" src={item.posterUrl} /> : null}
    </div>
    <div className="min-w-0 flex-1 py-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 truncate text-base font-semibold tracking-[-0.01em] text-ink">{item.title}</h3>
        <span className="flex-none rounded-full bg-soft px-2 py-0.5 text-xs font-semibold text-muted">{Math.round(score)} taste pick</span>
      </div>
      <p className="mt-1 text-xs text-muted">{item.year} · {item.genre}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-[1.5] text-ink">{reason}</p>
    </div>
  </Link>;
}
