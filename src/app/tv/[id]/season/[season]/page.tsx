import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { SiteHeader } from "@/components/site-header";
import { formatFullDate } from "@/lib/format";
import { getSeasonDetails, isTmdbNotFound } from "@/lib/tmdb";

export const revalidate = 3600;

function parseRouteParams(id: string, season: string) {
  const showId = Number(id);
  const seasonNumber = Number(season);
  if (!Number.isInteger(showId) || showId < 1 || !Number.isInteger(seasonNumber) || seasonNumber < 0) return null;
  return { showId, seasonNumber };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; season: string }> }): Promise<Metadata> {
  const { id, season } = await params;
  const parsed = parseRouteParams(id, season);
  if (!parsed) return {};

  const seasonDetail = await getSeasonDetails(parsed.showId, parsed.seasonNumber).catch(() => null);
  if (!seasonDetail) return {};

  return { title: `${seasonDetail.showName} — ${seasonDetail.name} — NextScene`, description: seasonDetail.overview };
}

export default async function SeasonPage({ params }: { params: Promise<{ id: string; season: string }> }) {
  const { id, season } = await params;
  const parsed = parseRouteParams(id, season);
  if (!parsed) notFound();

  const seasonDetail = await getSeasonDetails(parsed.showId, parsed.seasonNumber).catch((error: unknown) => {
    if (isTmdbNotFound(error)) notFound();
    return null;
  });

  if (!seasonDetail) return <main className="pb-24"><SiteHeader /><CatalogError /></main>;

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-[38px] max-[760px]:pb-[25px]">
      <BackButton className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref={`/tv/${parsed.showId}`} ariaLabel={`Back to ${seasonDetail.showName}`} />
      <div className="flex gap-6 max-[760px]:flex-col">
        {seasonDetail.posterUrl ? <div className="aspect-[0.68] w-[180px] flex-none overflow-hidden rounded-xl bg-soft max-[760px]:w-[140px]">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${seasonDetail.posterUrl})` }} />
        </div> : null}
        <div>
          <p className="m-0 text-sm font-medium text-muted">{seasonDetail.showName}</p>
          <h1 className="m-0 mt-1 text-[clamp(32px,4.5vw,56px)] font-bold leading-[1.02] tracking-[-0.02em]">{seasonDetail.name}</h1>
          <p className="mt-3 text-sm text-muted">{seasonDetail.episodes.length} episode{seasonDetail.episodes.length === 1 ? "" : "s"}{seasonDetail.airDate ? ` · ${formatFullDate(seasonDetail.airDate)}` : ""}</p>
          {seasonDetail.overview ? <p className="mt-4 max-w-[620px] text-sm leading-[1.55] text-muted">{seasonDetail.overview}</p> : null}
        </div>
      </div>
    </section>

    <section className="page-width">
      {seasonDetail.episodes.length > 0 ? <div className="flex flex-col gap-3">
        {seasonDetail.episodes.map((episode) => <Link
          className="group flex gap-4 rounded-xl border border-line p-3 transition-colors hover:bg-soft max-[760px]:flex-col"
          href={`/tv/${parsed.showId}/season/${parsed.seasonNumber}/episode/${episode.episodeNumber}`}
          key={episode.id}
        >
          <div className="aspect-video w-[220px] flex-none overflow-hidden rounded-lg bg-soft max-[760px]:w-full">
            {episode.stillUrl ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${episode.stillUrl})` }} /> : null}
          </div>
          <div className="min-w-0 flex-1 py-1">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-muted">Episode {episode.episodeNumber}</p>
            <h3 className="m-0 mt-1 truncate text-base font-semibold tracking-[-0.01em] text-ink">{episode.name}</h3>
            <p className="mt-1 text-xs text-muted">
              {[episode.airDate ? formatFullDate(episode.airDate) : null, episode.runtime ? `${episode.runtime} min` : null, episode.audienceScore ? `${episode.audienceScore}% score` : null].filter(Boolean).join(" · ")}
            </p>
            {episode.overview ? <p className="mt-2 line-clamp-2 text-sm leading-[1.5] text-muted">{episode.overview}</p> : null}
          </div>
        </Link>)}
      </div> : <p className="text-sm text-muted">No episode information is available for this season yet.</p>}
    </section>
  </main>;
}
