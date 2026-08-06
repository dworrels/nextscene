import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Film, Star } from "lucide-react";
import { MovieRail } from "@/components/movie-rail";
import { SiteHeader } from "@/components/site-header";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersSection } from "@/components/watch-providers";
import { getMovieDetails } from "@/lib/tmdb";

export const revalidate = 3600;

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
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
  const infoRows = [
    { label: "Released", value: formatFullDate(movie.releaseDate) },
    { label: "Runtime", value: movie.runtime ? `${movie.runtime} min` : null },
    { label: "Rated", value: movie.certification },
    { label: "Genres", value: movie.genres.join(", ") || null },
    { label: "Original Language", value: movie.originalLanguage },
    { label: "Director", value: movie.director },
  ].filter((row) => row.value);

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[520px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: movie.backdropUrl ? `url(${movie.backdropUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <Link className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white" href="/"><ArrowLeft className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" /> Back to home</Link>
      <div className="max-w-[560px] max-[760px]:max-w-none px-10 pb-16 max-[760px]:px-6 max-[760px]:pb-10">
        <h1 className="m-0 text-[clamp(42px,6vw,84px)] max-[760px]:text-[52px] font-bold leading-[0.98] tracking-[-0.02em] text-white">{movie.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-white/70">
          <span className="inline-flex items-center gap-1.5"><Film className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> Movie</span>
          {movie.genres.length > 0 ? <span>{movie.genres.join(", ")}</span> : null}
          {movie.certification ? <span className="rounded border border-white/40 px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-white">{movie.certification}</span> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-white/70">
          <span>{movie.year}</span>
          {movie.runtime ? <span>{movie.runtime} min</span> : null}
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden="true" /> {movie.audienceScore}% TMDb score</span>
        </div>

        {movie.tagline ? <p className="mt-4 text-xl font-medium leading-[1.35] text-white/85">{movie.tagline}</p> : null}
        <p className="mt-4 max-w-[500px] text-base leading-[1.55] text-white/85">{movie.overview}</p>
        {movie.trailerKey ? <div className="mt-7"><TrailerButton videoKey={movie.trailerKey} /></div> : null}
      </div>
    </article>

    {movie.recommendations.length > 0 ? <MovieRail title="Related" items={movie.recommendations} href={`/movies/${movie.id}/recommendations`} /> : null}

    {movie.cast.length > 0 ? <section className="page-width mt-10">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Cast &amp; Crew</h2>
      <div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {movie.cast.map((member) => <div className="w-[92px] flex-none text-center" key={member.id}>
          <div className="mx-auto mb-2 h-[92px] w-[92px] rounded-full bg-soft bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
          <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
          <p className="m-0 truncate text-[11px] text-muted">{member.character}</p>
        </div>)}
      </div>
    </section> : null}

    <WatchProvidersSection watchProviders={movie.watchProviders} />

    {movie.releaseTimeline.length > 0 ? <section className="page-width mt-10 max-w-[420px]">
      <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Release timeline</h2>
      <div className="border-t border-line">
        {movie.releaseTimeline.map((entry, index) => <div className="flex items-center justify-between border-b border-line py-3 text-sm" key={`${entry.type}-${index}`}>
          <span className="text-muted">{entry.type}</span>
          <span className="font-medium text-ink">{formatFullDate(entry.date)}</span>
        </div>)}
      </div>
    </section> : null}

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
