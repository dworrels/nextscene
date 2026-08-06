import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, Tv } from "lucide-react";
import { MovieRail } from "@/components/movie-rail";
import { SiteHeader } from "@/components/site-header";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersSection } from "@/components/watch-providers";
import { getTvDetails } from "@/lib/tmdb";

export const revalidate = 3600;

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const showId = Number(id);
  if (!Number.isInteger(showId) || showId < 1) return {};

  const show = await getTvDetails(showId).catch(() => null);
  if (!show) return {};

  const description = show.tagline || show.overview;
  return {
    title: `${show.title} — NextScene`,
    description,
    openGraph: {
      title: show.title,
      description,
      images: show.backdropUrl ? [show.backdropUrl] : undefined,
    },
  };
}

export default async function TvShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const showId = Number(id);
  if (!Number.isInteger(showId) || showId < 1) notFound();

  const show = await getTvDetails(showId).catch(() => notFound());
  const infoRows = [
    { label: "First Aired", value: formatFullDate(show.releaseDate) },
    { label: "Status", value: show.status },
    { label: "Episode Runtime", value: show.episodeRuntime ? `${show.episodeRuntime} min` : null },
    { label: "Seasons", value: `${show.numberOfSeasons} (${show.numberOfEpisodes} episodes)` },
    { label: "Rated", value: show.certification },
    { label: "Genres", value: show.genres.join(", ") || null },
    { label: "Original Language", value: show.originalLanguage },
    { label: "Created By", value: show.creators.join(", ") || null },
    { label: "Networks", value: show.networks.join(", ") || null },
  ].filter((row) => row.value);

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[520px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: show.backdropUrl ? `url(${show.backdropUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <Link className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white" href="/"><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to home</Link>
      <div className="max-w-[560px] max-[760px]:max-w-none px-10 pb-16 max-[760px]:px-6 max-[760px]:pb-10">
        <h1 className="m-0 text-[clamp(42px,6vw,84px)] max-[760px]:text-[52px] font-bold leading-[0.98] tracking-[-0.02em] text-white">{show.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-white/70">
          <span className="inline-flex items-center gap-1.5"><Tv className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> TV Show</span>
          {show.genres.length > 0 ? <span>{show.genres.join(", ")}</span> : null}
          {show.certification ? <span className="rounded border border-white/40 px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-white">{show.certification}</span> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-white/70">
          <span>{show.year}</span>
          {show.episodeRuntime ? <span>{show.episodeRuntime} min</span> : null}
          <span>{show.numberOfSeasons} season{show.numberOfSeasons === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden="true" /> {show.audienceScore}% TMDb score</span>
        </div>

        {show.tagline ? <p className="mt-4 text-xl font-medium leading-[1.35] text-white/85">{show.tagline}</p> : null}
        <p className="mt-4 max-w-[500px] text-base leading-[1.55] text-white/85">{show.overview}</p>
        {show.trailerKey ? <div className="mt-7"><TrailerButton videoKey={show.trailerKey} /></div> : null}
      </div>
    </article>

    {show.seasons.length > 0 ? <section className="page-width mt-10">
      <h2 className="m-0 mb-5 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em]">Seasons</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mr-4 pr-4 [scrollbar-width:none]">
        {show.seasons.map((season) => <a
          className="group block w-[148px] flex-none"
          href={`/tv/${show.id}/season/${season.seasonNumber}`}
          key={season.id}
        >
          <div className="h-[222px] w-[148px] overflow-hidden rounded-xl bg-soft transition-transform duration-300 ease-out group-hover:scale-[1.04]">
            {season.posterUrl ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${season.posterUrl})` }} /> : null}
          </div>
          <div className="mt-3">
            <h3 className="m-0 truncate text-sm font-semibold tracking-[-0.01em] text-ink">{season.name}</h3>
            <p className="mt-1 truncate text-xs text-muted">{season.episodeCount} episode{season.episodeCount === 1 ? "" : "s"}{season.airDate ? ` · ${formatFullDate(season.airDate)}` : ""}</p>
          </div>
        </a>)}
      </div>
    </section> : null}

    {show.recommendations.length > 0 ? <MovieRail title="Related" items={show.recommendations} href={`/tv/${show.id}/recommendations`} /> : null}

    {show.cast.length > 0 ? <section className="page-width mt-10">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Cast &amp; Crew</h2>
      <div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {show.cast.map((member) => <div className="w-[92px] flex-none text-center" key={member.id}>
          <div className="mx-auto mb-2 h-[92px] w-[92px] rounded-full bg-soft bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
          <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
          <p className="m-0 truncate text-[11px] text-muted">{member.character}</p>
        </div>)}
      </div>
    </section> : null}

    <WatchProvidersSection watchProviders={show.watchProviders} />

    {infoRows.length > 0 ? <section className="page-width mt-10 border-t border-line pt-8">
      <h2 className="m-0 mb-5 text-[20px] font-[650] tracking-[-0.02em]">Information</h2>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 max-[600px]:grid-cols-1">
        {infoRows.map((row) => <div key={row.label}>
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{row.label}</dt>
          <dd className="m-0 mt-1 text-sm font-medium text-ink">{row.value}</dd>
        </div>)}
      </dl>
    </section> : null}
  </main>;
}
