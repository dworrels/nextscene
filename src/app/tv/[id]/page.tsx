import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star, Tv } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { FavoriteButton } from "@/components/favorite-button";
import { MovieRail } from "@/components/movie-rail";
import { RatingControl } from "@/components/rating-control";
import { SeasonBaselinePicker } from "@/components/season-baseline-picker";
import { SiteHeader } from "@/components/site-header";
import { TrailerButton } from "@/components/trailer-button";
import { WatchProvidersSection } from "@/components/watch-providers";
import { WatchlistButton } from "@/components/watchlist-button";
import { WhyWatch } from "@/components/why-watch";
import { getInitialWhyWatchState } from "@/lib/why-watch-actions";
import { formatFullDate, formatRuntime } from "@/lib/format";
import { isFavorite } from "@/lib/favorites";
import { getRating } from "@/lib/ratings";
import { getTvDetails, isTmdbNotFound } from "@/lib/tmdb";
import { isInWatchlist } from "@/lib/watchlist";

export const revalidate = 3600;

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

  const show = await getTvDetails(showId).catch((error: unknown) => {
    if (isTmdbNotFound(error)) notFound();
    return null;
  });

  if (!show) return <main className="pb-24"><SiteHeader /><CatalogError /></main>;

  const [whyWatchState, inWatchlist, rating, favorited] = await Promise.all([
    getInitialWhyWatchState(show),
    isInWatchlist("tv", show.id),
    getRating("tv", show.id),
    isFavorite("tv", show.id),
  ]);

  const infoRows = [
    { label: "First Aired", value: formatFullDate(show.releaseDate) },
    { label: "Status", value: show.status },
    { label: "Episode Runtime", value: show.episodeRuntime ? `${show.episodeRuntime} min` : null },
    { label: "Seasons", value: `${show.numberOfSeasons} (${show.numberOfEpisodes} episodes)` },
    { label: "Rated", value: show.certification },
    { label: "Genres", value: show.genres.join(", ") || null },
    { label: "Original Language", value: show.originalLanguage },
    { label: "Countries", value: show.productionCountries.join(", ") || null },
    { label: "Created By", value: show.creators.join(", ") || null },
    { label: "Networks", value: show.networks.join(", ") || null },
  ].filter((row) => row.value);

  return <main className="pb-24">
    <SiteHeader />
    <article className="page-width relative isolate flex min-h-[min(660px,76vh)] max-[760px]:min-h-[480px] max-[480px]:min-h-[420px] items-end overflow-hidden rounded-[18px] max-[760px]:rounded-[11px] bg-[#111] text-white [clip-path:inset(0_round_18px)] max-[760px]:[clip-path:inset(0_round_11px)]">
      <div className="absolute inset-0 -z-[2] rounded-[18px] max-[760px]:rounded-[11px] bg-[#252725] bg-cover bg-center" style={{ backgroundImage: show.backdropUrl ? `url(${show.backdropUrl})` : undefined }} />
      <div className="absolute inset-0 -z-[1] rounded-[18px] max-[760px]:rounded-[11px] bg-[linear-gradient(90deg,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_45%,rgba(0,0,0,.05)_80%),linear-gradient(0deg,rgba(0,0,0,.75),transparent_60%)]" />
      <BackButton className="absolute left-10 top-8 max-[760px]:left-6 max-[760px]:top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" fallbackHref="/" ariaLabel="Go back" />
      <div className="min-w-0 max-w-[520px] max-[760px]:max-w-none px-10 pt-24 pb-16 max-[760px]:px-6 max-[760px]:pt-20 max-[760px]:pb-9 max-[480px]:px-4 max-[480px]:pt-20 max-[480px]:pb-7">
        <h1 className="m-0 text-[clamp(42px,6vw,84px)] max-[760px]:text-[40px] max-[480px]:text-[32px] font-bold leading-[0.98] max-[760px]:leading-[1.06] tracking-[-0.02em] text-white break-words">{show.title}</h1>

        <div className="mt-7 max-[760px]:mt-5 flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] max-[760px]:grid max-[760px]:grid-cols-2 max-[760px]:overflow-visible max-[760px]:gap-3 max-[760px]:[&>button]:w-full max-[760px]:[&>form]:min-w-0 max-[760px]:[&>form>button]:w-full max-[760px]:[&>form:last-child]:justify-self-start max-[760px]:[&>form:last-child>button]:w-auto">
          {show.trailerKey ? <TrailerButton videoKey={show.trailerKey} /> : null}
          <WatchlistButton
            imdbId={show.imdbId}
            inWatchlist={inWatchlist}
            mediaType="tv"
            releaseDate={show.releaseDate || null}
            title={show.title}
            tmdbId={show.id}
          />
          <RatingControl mediaType="tv" rating={rating} title={show.title} tmdbId={show.id} />
          <FavoriteButton isFavorite={favorited} mediaType="tv" title={show.title} tmdbId={show.id} />
        </div>
      </div>
    </article>

    <section className="page-width mt-6 max-[760px]:mt-5">
      <div className="rounded-2xl border border-line bg-soft p-6 max-[480px]:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-muted">
          <span className="inline-flex items-center gap-1.5 text-ink"><Tv className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> TV Show</span>
          {show.genres.length > 0 ? <span>{show.genres.join(", ")}</span> : null}
          {show.certification ? <span className="rounded border border-line px-1.5 py-0.5 text-xs font-semibold tracking-[0.02em] text-ink">{show.certification}</span> : null}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm font-medium text-muted">
          <span>{show.year}</span>
          {show.episodeRuntime ? <><span aria-hidden="true">·</span><span>{formatRuntime(show.episodeRuntime)}</span></> : null}
          <span aria-hidden="true">·</span>
          <span>{show.numberOfSeasons} season{show.numberOfSeasons === 1 ? "" : "s"}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-ink" strokeWidth={0} aria-hidden="true" /> {show.audienceScore}% TMDb score</span>
        </p>

        {show.tagline ? <p className="mt-4 text-lg font-medium leading-[1.35] text-ink">{show.tagline}</p> : null}
        <p className="mt-4 max-w-[620px] text-base leading-[1.6] text-ink">{show.overview}</p>
      </div>
    </section>

    <WhyWatch id={show.id} mediaType="tv" initialState={whyWatchState} />

    {show.seasons.length > 0 ? <section className="page-width mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="m-0 text-[28px] font-[650] leading-[1.12] tracking-[-0.02em]">Seasons</h2>
        <SeasonBaselinePicker seasons={show.seasons} showId={show.id} showTitle={show.title} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mr-10 pr-10 max-[760px]:-mr-6 max-[760px]:pr-6 max-[480px]:-mr-4 max-[480px]:pr-4 [scrollbar-width:none]">
        {show.seasons.map((season) => <Link
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
        </Link>)}
      </div>
    </section> : null}

    {show.recommendations.length > 0 ? <MovieRail title="Related" items={show.recommendations} href={`/tv/${show.id}/recommendations`} /> : null}

    {show.cast.length > 0 ? <section className="page-width mt-10">
      <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
        <h2 className="m-0 mb-4 text-[20px] font-[650] tracking-[-0.02em]">Cast &amp; Crew</h2>
        <div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
          {show.cast.map((member) => <div className="w-[92px] flex-none text-center" key={member.id}>
            <div className="mx-auto mb-2 h-[92px] w-[92px] rounded-full bg-well bg-cover bg-center" style={{ backgroundImage: member.profileUrl ? `url(${member.profileUrl})` : undefined }} />
            <p className="m-0 truncate text-xs font-semibold text-ink">{member.name}</p>
            <p className="m-0 truncate text-xs text-muted">{member.character}</p>
          </div>)}
        </div>
      </div>
    </section> : null}

    <WatchProvidersSection watchProviders={show.watchProviders} />

    {infoRows.length > 0 ? <section className="page-width mt-10">
      <div className="rounded-[28px] border border-line/60 bg-soft p-5 max-[480px]:p-4 min-[760px]:p-6">
        <h2 className="m-0 mb-3 text-[20px] font-[650] tracking-[-0.02em]">Details</h2>
        <div className="divide-y divide-line border-t border-line">
          {infoRows.map((row) => <div className="flex items-center justify-between gap-6 py-3 text-sm" key={row.label}>
            <span className="text-muted">{row.label}</span>
            <span className="text-right font-medium text-ink">{row.value}</span>
          </div>)}
        </div>
      </div>
    </section> : null}
  </main>;
}
