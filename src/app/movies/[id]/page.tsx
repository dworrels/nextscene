import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FilmCard } from "@/components/film-card";
import { SiteHeader } from "@/components/site-header";
import { TrailerButton } from "@/components/trailer-button";
import { getMovieDetails } from "@/lib/tmdb";
import type { WatchProvider } from "@/types/tmdb";

export const revalidate = 3600;

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function ProviderGroup({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;

  return <div className="mb-3">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
    <div className="flex flex-wrap gap-3">
      {providers.map((provider) => <div key={provider.id} className="flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-xs font-medium text-ink">
        {provider.logoUrl ? <span className="h-5 w-5 flex-none rounded bg-cover bg-center" style={{ backgroundImage: `url(${provider.logoUrl})` }} /> : null}
        {provider.name}
      </div>)}
    </div>
  </div>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId < 1) return {};

  const movie = await getMovieDetails(movieId).catch(() => null);
  if (!movie) return {};

  const description = movie.tagline || movie.overview;
  return {
    title: `${movie.title} — NextScene`,
    description,
    openGraph: {
      title: movie.title,
      description,
      images: movie.backdropUrl ? [movie.backdropUrl] : undefined,
    },
  };
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId < 1) notFound();

  const movie = await getMovieDetails(movieId).catch(() => notFound());
  const metaParts = [movie.year, movie.certification, movie.runtime ? `${movie.runtime} min` : null, movie.genres.join(" · ")].filter(Boolean);
  const hasWatchProviders = movie.watchProviders.flatrate.length > 0 || movie.watchProviders.rent.length > 0 || movie.watchProviders.buy.length > 0;

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[520px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: movie.backdropUrl ? `url(${movie.backdropUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <a className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white" href="/discover"><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to discover</a>
      <div className="max-w-[560px] max-[760px]:max-w-none px-10 pb-16 max-[760px]:px-6 max-[760px]:pb-10">
        <h1 className="m-0 text-[clamp(42px,6vw,84px)] max-[760px]:text-[52px] font-bold leading-[0.98] tracking-[-0.02em] text-white">{movie.title}</h1>
        {movie.tagline ? <p className="mt-4 text-xl font-medium leading-[1.35] text-white/85">{movie.tagline}</p> : null}
        <p className="mt-6 max-w-[500px] text-base leading-[1.55] text-white/85">{movie.overview}</p>
        {movie.trailerKey ? <div className="mt-7"><TrailerButton videoKey={movie.trailerKey} /></div> : null}
      </div>
    </article>

    <section className="page-width mt-6">
      <p className="text-sm text-muted">{metaParts.join(" · ")} · <span className="font-semibold text-ink">{movie.audienceScore}% TMDb audience score</span></p>
    </section>

    {movie.cast.length > 0 ? <section className="page-width mt-10">
      {movie.director ? <p className="mb-4 text-sm text-muted">Directed by <span className="font-semibold text-ink">{movie.director}</span></p> : null}
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {movie.cast.map((member) => <div className="w-[100px] flex-none" key={member.id}>
          <div className="mb-2 aspect-[0.8] rounded-lg bg-soft bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
          <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
          <p className="m-0 truncate text-[11px] text-muted">{member.character}</p>
        </div>)}
      </div>
    </section> : null}

    {hasWatchProviders ? <section className="page-width mt-10 max-w-[560px]">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Where to watch</h2>
      <ProviderGroup label="Stream" providers={movie.watchProviders.flatrate} />
      <ProviderGroup label="Rent" providers={movie.watchProviders.rent} />
      <ProviderGroup label="Buy" providers={movie.watchProviders.buy} />
      <p className="mt-4 text-xs text-muted">
        Streaming data provided by <a className="underline hover:text-ink" href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>.
        {movie.watchProviders.link ? <> <a className="underline hover:text-ink" href={movie.watchProviders.link} target="_blank" rel="noreferrer">More watch options</a></> : null}
      </p>
    </section> : null}

    {movie.releaseTimeline.length > 0 ? <section className="page-width mt-10 max-w-[420px]">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Release timeline</h2>
      <div className="border-t border-line">
        {movie.releaseTimeline.map((entry, index) => <div className="flex items-center justify-between border-b border-line py-3 text-sm" key={`${entry.type}-${index}`}>
          <span className="text-muted">{entry.type}</span>
          <span className="font-medium text-ink">{formatFullDate(entry.date)}</span>
        </div>)}
      </div>
    </section> : null}

    {movie.similar.length > 0 ? <section className="page-width mt-10">
      <h2 className="m-0 mb-5 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em]">More like this</h2>
      <div className="grid grid-cols-4 gap-[14px] max-[760px]:flex max-[760px]:gap-[13px] max-[760px]:-mr-4 max-[760px]:overflow-x-auto max-[760px]:pr-4 max-[760px]:[scrollbar-width:none]">
        {movie.similar.map((similar) => <FilmCard movie={similar} key={similar.id} />)}
      </div>
    </section> : null}
  </main>;
}
