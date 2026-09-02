import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Film, Star } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { FavoriteButton } from "@/components/favorite-button";
import { MovieRail } from "@/components/movie-rail";
import { RatingControl } from "@/components/rating-control";
import { SiteHeader } from "@/components/site-header";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersSection } from "@/components/watch-providers";
import { WatchlistButton } from "@/components/watchlist-button";
import { WhyWatch } from "@/components/why-watch";
import { getInitialWhyWatchState } from "@/lib/why-watch-actions";
import { filterReleaseTimeline, formatFullDate, formatRuntime } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { getRating } from "@/lib/ratings";
import { getMovieDetails, isTmdbNotFound } from "@/lib/tmdb";
import { isInWatchlist } from "@/lib/watchlist";

export const revalidate = 3600;

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

  const movie = await getMovieDetails(movieId).catch((error: unknown) => {
    if (isTmdbNotFound(error)) notFound();
    return null;
  });

  if (!movie) return <main className="pb-24"><SiteHeader /><CatalogError /></main>;

  const [whyWatchState, inWatchlist, rating, favorited] = await Promise.all([
    getInitialWhyWatchState(movie),
    isInWatchlist("movie", movie.id),
    getRating("movie", movie.id),
    isFavorite("movie", movie.id),
  ]);

  const infoRows = [
    { label: "Released", value: formatFullDate(movie.releaseDate) },
    { label: "Runtime", value: movie.runtime ? `${movie.runtime} min` : null },
    { label: "Rated", value: movie.certification },
    { label: "Genres", value: movie.genres.join(", ") || null },
    { label: "Original Language", value: movie.originalLanguage },
    { label: "Countries", value: movie.productionCountries.join(", ") || null },
    { label: "Director", value: movie.director },
  ].filter((row) => row.value);
  const releaseTimeline = filterReleaseTimeline(movie.releaseTimeline);

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[480px] max-[480px]:min-h-[420px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: movie.backdropUrl ? `url(${movie.backdropUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <BackButton className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" fallbackHref="/" ariaLabel="Go back" />
      <div className="min-w-0 max-w-[520px] max-[760px]:max-w-none px-10 pt-24 pb-16 max-[760px]:px-6 max-[760px]:pt-20 max-[760px]:pb-9 max-[480px]:px-4 max-[480px]:pt-20 max-[480px]:pb-7">
        <h1 className="m-0 text-[clamp(42px,6vw,84px)] max-[760px]:text-[40px] max-[480px]:text-[32px] font-bold leading-[0.98] max-[760px]:leading-[1.06] tracking-[-0.02em] text-white break-words">{movie.title}</h1>

        <div className="mt-7 max-[760px]:mt-5 flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] max-[760px]:grid max-[760px]:grid-cols-2 max-[760px]:overflow-visible max-[760px]:gap-3 max-[760px]:[&>button]:w-full max-[760px]:[&>form]:min-w-0 max-[760px]:[&>form>button]:w-full max-[760px]:[&>form:last-child]:justify-self-start max-[760px]:[&>form:last-child>button]:w-auto">
          {movie.trailerKey ? <TrailerButton videoKey={movie.trailerKey} /> : null}
          <WatchlistButton
            imdbId={movie.imdbId}
            inWatchlist={inWatchlist}
            mediaType="movie"
            releaseDate={movie.releaseDate || null}
            title={movie.title}
            tmdbId={movie.id}
          />
          <RatingControl mediaType="movie" rating={rating} title={movie.title} tmdbId={movie.id} />
          <FavoriteButton isFavorite={favorited} mediaType="movie" title={movie.title} tmdbId={movie.id} />
        </div>
      </div>
    </article>

    <section className="page-width mt-6 max-[760px]:mt-5">
      <div className="rounded-2xl border border-line bg-soft p-6 max-[480px]:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-muted">
          <span className="inline-flex items-center gap-1.5 text-ink"><Film className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> Movie</span>
          {movie.genres.length > 0 ? <span>{movie.genres.join(", ")}</span> : null}
          {movie.certification ? <span className="rounded border border-line px-1.5 py-0.5 text-xs font-semibold tracking-[0.02em] text-ink">{movie.certification}</span> : null}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm font-medium text-muted">
          <span>{movie.year}</span>
          {movie.runtime ? <><span aria-hidden="true">·</span><span>{formatRuntime(movie.runtime)}</span></> : null}
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-ink" strokeWidth={0} aria-hidden="true" /> {movie.audienceScore}% TMDb score</span>
        </p>

        {movie.tagline ? <p className="mt-4 text-lg font-medium leading-[1.35] text-ink">{movie.tagline}</p> : null}
        <p className="mt-4 max-w-[620px] text-base leading-[1.6] text-ink">{movie.overview}</p>
      </div>
    </section>

    <WhyWatch id={movie.id} mediaType="movie" initialState={whyWatchState} />

    {movie.recommendations.length > 0 ? <MovieRail title="Related" items={movie.recommendations} href={`/movies/${movie.id}/recommendations`} /> : null}

    {movie.cast.length > 0 ? <section className="page-width mt-10">
      <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Cast &amp; Crew</h2>
        <div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
          {movie.cast.map((member) => <div className="w-[92px] flex-none text-center" key={member.id}>
            <div className="mx-auto mb-2 h-[92px] w-[92px] rounded-full bg-well bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
            <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
            <p className="m-0 truncate text-xs text-muted">{member.character}</p>
          </div>)}
        </div>
      </div>
    </section> : null}

    <WatchProvidersSection watchProviders={movie.watchProviders} />

    {infoRows.length > 0 || releaseTimeline.length > 0 ? <section className="page-width mt-10">
      <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
        <div className={`grid grid-cols-1 gap-y-8 ${infoRows.length > 0 && releaseTimeline.length > 0 ? "min-[760px]:grid-cols-2 min-[760px]:gap-y-0 min-[760px]:divide-x min-[760px]:divide-line" : ""}`}>
          {infoRows.length > 0 ? <div className={releaseTimeline.length > 0 ? "min-[760px]:pr-8" : ""}>
            <h2 className="m-0 mb-3 text-[20px] font-[650] tracking-[-0.02em]">Details</h2>
            <div className="divide-y divide-line border-t border-line">
              {infoRows.map((row) => <div className="flex items-center justify-between gap-6 py-3 text-sm" key={row.label}>
                <span className="text-muted">{row.label}</span>
                <span className="text-right font-medium text-ink">{row.value}</span>
              </div>)}
            </div>
          </div> : null}
          {releaseTimeline.length > 0 ? <div className={infoRows.length > 0 ? "min-[760px]:pl-8" : ""}>
            <h2 className="m-0 mb-3 text-[20px] font-[650] tracking-[-0.02em]">Release history</h2>
            <div className="divide-y divide-line border-t border-line">
              {releaseTimeline.map((entry, index) => <div className="flex items-center justify-between py-3 text-sm" key={`${entry.type}-${index}`}>
                <span className="text-muted">{entry.type}</span>
                <span className="font-medium text-ink">{entry.date}</span>
              </div>)}
            </div>
          </div> : null}
        </div>
      </div>
    </section> : null}
  </main>;
}
