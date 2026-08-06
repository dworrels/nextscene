import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getEpisodeDetails } from "@/lib/tmdb";

export const revalidate = 3600;

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function parseRouteParams(id: string, season: string, episode: string) {
  const showId = Number(id);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  if (
    !Number.isInteger(showId) || showId < 1 ||
    !Number.isInteger(seasonNumber) || seasonNumber < 0 ||
    !Number.isInteger(episodeNumber) || episodeNumber < 1
  ) return null;
  return { showId, seasonNumber, episodeNumber };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; season: string; episode: string }> }): Promise<Metadata> {
  const { id, season, episode } = await params;
  const parsed = parseRouteParams(id, season, episode);
  if (!parsed) return {};

  const detail = await getEpisodeDetails(parsed.showId, parsed.seasonNumber, parsed.episodeNumber).catch(() => null);
  if (!detail) return {};

  return {
    title: `${detail.showName} — S${detail.seasonNumber}E${detail.episodeNumber} ${detail.name} — NextScene`,
    description: detail.overview,
    openGraph: { title: detail.name, description: detail.overview, images: detail.stillUrl ? [detail.stillUrl] : undefined },
  };
}

export default async function EpisodePage({ params }: { params: Promise<{ id: string; season: string; episode: string }> }) {
  const { id, season, episode } = await params;
  const parsed = parseRouteParams(id, season, episode);
  if (!parsed) notFound();

  const detail = await getEpisodeDetails(parsed.showId, parsed.seasonNumber, parsed.episodeNumber).catch(() => notFound());
  const metaParts = [
    detail.airDate ? formatFullDate(detail.airDate) : null,
    detail.runtime ? `${detail.runtime} min` : null,
  ].filter(Boolean);
  const directors = detail.crew.filter((member) => member.job === "Director").map((member) => member.name);
  const writers = detail.crew.filter((member) => member.job === "Writer" || member.job === "Story").map((member) => member.name);

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[440px] max-[760px]:min-h-[340px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: detail.stillUrl ? `url(${detail.stillUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <a className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white" href={`/tv/${parsed.showId}/season/${parsed.seasonNumber}`}>
        <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to {detail.showName} — Season {parsed.seasonNumber}
      </a>
      <div className="max-w-[620px] max-[760px]:max-w-none px-10 pb-10 max-[760px]:px-6 max-[760px]:pb-8">
        <p className="m-0 text-sm font-medium text-white/70">{detail.showName} · Episode {detail.episodeNumber}</p>
        <h1 className="m-0 mt-2 text-[clamp(32px,4.8vw,64px)] max-[760px]:text-[38px] font-bold leading-[1.02] tracking-[-0.02em] text-white">{detail.name}</h1>
      </div>
    </article>

    <section className="page-width mt-6">
      <p className="text-sm text-muted">{metaParts.join(" · ")}{detail.audienceScore ? <> · <span className="font-semibold text-ink">{detail.audienceScore}% TMDb audience score</span></> : null}</p>
      {detail.overview ? <p className="mt-4 max-w-[620px] text-base leading-[1.55] text-ink">{detail.overview}</p> : null}
    </section>

    {directors.length > 0 || writers.length > 0 ? <section className="page-width mt-8 max-w-[620px]">
      {directors.length > 0 ? <p className="text-sm text-muted">Directed by <span className="font-semibold text-ink">{directors.join(", ")}</span></p> : null}
      {writers.length > 0 ? <p className="mt-1 text-sm text-muted">Written by <span className="font-semibold text-ink">{writers.join(", ")}</span></p> : null}
    </section> : null}

    {detail.guestStars.length > 0 ? <section className="page-width mt-10">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Guest stars</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {detail.guestStars.map((member) => <div className="w-[100px] flex-none" key={member.id}>
          <div className="mb-2 aspect-[0.8] rounded-lg bg-soft bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
          <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
          <p className="m-0 truncate text-[11px] text-muted">{member.character}</p>
        </div>)}
      </div>
    </section> : null}
  </main>;
}
