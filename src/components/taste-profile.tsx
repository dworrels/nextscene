import Link from "next/link";
import { Arrow } from "@/components/icons";
import { FilmCard } from "@/components/film-card";
import { RatingsImportForm } from "@/components/ratings-import-form";
import { readRatings } from "@/lib/ratings";
import { getMediaCards } from "@/lib/tmdb";

const RECENT_PREVIEW_COUNT = 8;

export async function TasteProfile() {
  const { rows } = await readRatings();

  if (rows.length === 0) {
    return <section className="page-width mt-16 max-[760px]:mt-10" aria-labelledby="taste-profile-heading">
      <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
        <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]" id="taste-profile-heading">No ratings yet</h2>
        <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">Import your IMDb ratings export to unlock personal recommendations and taste insights.</p>
        <RatingsImportForm variant="empty" />
      </div>
    </section>;
  }

  const matched = rows.filter((row) => row.tmdbId !== null);

  const recent = [...matched]
    .sort((a, b) => (b.ratedAt ?? "").localeCompare(a.ratedAt ?? ""))
    .slice(0, RECENT_PREVIEW_COUNT);
  const recentCards = recent.length > 0
    ? await getMediaCards(recent.map((row) => ({ id: row.tmdbId as number, mediaType: row.mediaType }))).catch(() => new Map())
    : new Map();

    return <section className="page-width mt-16 max-[760px]:mt-10" aria-labelledby="taste-profile-heading">
      <div className="rounded-2xl bg-soft px-8 py-10 max-[760px]:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em] max-[760px]:text-[25px]" id="taste-profile-heading">
            <Link className="inline-flex items-center gap-2 hover:opacity-70" href="/ratings">Your taste profile <Arrow /></Link>
          </h2>
        </div>
      {recent.length > 0 ? <div className="mt-6 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {recent.map((row) => {
          const card = recentCards.get(`${row.mediaType}-${row.tmdbId}`);
          return card ? <FilmCard movie={card} badge={`${row.rating}/10`} key={row.imdbId} /> : null;
        })}
      </div> : null}
    </div>
  </section>;
}
