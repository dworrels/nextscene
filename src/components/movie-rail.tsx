import Link from "next/link";
import { FilmCard } from "@/components/film-card";
import { Arrow } from "@/components/icons";
import type { MediaItem } from "@/types/tmdb";

type MovieRailProps = {
  title: string;
  items: MediaItem[];
  href?: string;
  predictedBadges?: Record<string, string>;
  limit?: number;
};

export function MovieRail({ title, items, href, predictedBadges, limit = 8 }: MovieRailProps) {
  if (items.length === 0) return null;

  const cards = items.slice(0, limit).map((item) => {
    const key = `${item.mediaType}-${item.id}`;
    return <FilmCard movie={item} predictedBadge={predictedBadges?.[key]} key={key} />;
  });

  return <section className="page-width pt-14 max-[760px]:pt-9">
    <h2 className="m-0 mb-[18px] text-[22px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:mb-3.5 max-[760px]:text-[19px]">
      {href ? <Link className="inline-flex items-center gap-1.5 hover:opacity-70" href={href}>{title} <Arrow /></Link> : title}
    </h2>
    <div className="flex gap-3 overflow-x-auto pb-1 -mr-10 pr-10 max-[760px]:-mr-6 max-[760px]:pr-6 max-[480px]:-mr-4 max-[480px]:pr-4 [scrollbar-width:none]">
      {cards}
    </div>
  </section>;
}
