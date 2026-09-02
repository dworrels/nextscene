import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { DismissUpdateButton } from "@/components/dismiss-update-button";
import { FilmCard } from "@/components/film-card";
import { SiteHeader } from "@/components/site-header";
import { getFranchiseUpdateGroup, type FranchiseUpdateRow } from "@/lib/franchise-updates";
import { formatFullDate } from "@/lib/format";
import { getMediaCards } from "@/lib/tmdb";
import type { MediaItem, MediaType } from "@/types/tmdb";

function parseMediaType(value: string): MediaType | null {
  return value === "movie" || value === "tv" ? value : null;
}

function badgeFor(row: FranchiseUpdateRow) {
  const date = row.releaseDate ? formatFullDate(row.releaseDate) : null;
  return row.mediaType === "tv" ? `Season ${row.seasonNumber}${date ? `\n${date}` : ""}` : date ?? "TBA";
}

type PageParams = { mediaType: string; tmdbId: string };

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { mediaType, tmdbId } = await params;
  const parsedMediaType = parseMediaType(mediaType);
  const parsedTmdbId = Number(tmdbId);
  if (!parsedMediaType || !Number.isInteger(parsedTmdbId)) return {};

  const group = await getFranchiseUpdateGroup(parsedMediaType, parsedTmdbId);
  return group ? { title: `${group.sourceTitle} updates — NextScene` } : {};
}

export default async function UpdateGroupPage({ params }: { params: Promise<PageParams> }) {
  const { mediaType, tmdbId } = await params;
  const parsedMediaType = parseMediaType(mediaType);
  const parsedTmdbId = Number(tmdbId);
  if (!parsedMediaType || !Number.isInteger(parsedTmdbId) || parsedTmdbId < 1) notFound();

  const group = await getFranchiseUpdateGroup(parsedMediaType, parsedTmdbId);
  const sourceHref = parsedMediaType === "tv" ? `/tv/${parsedTmdbId}` : `/movies/${parsedTmdbId}`;

  const cards = group && group.rows.length > 0
    ? await getMediaCards(group.rows.map((row) => ({ id: row.tmdbId, mediaType: row.mediaType }))).catch(() => null)
    : new Map<string, MediaItem>();

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/updates" ariaLabel="Go back" />
      <h1 className="m-0 text-[clamp(32px,4.5vw,52px)] font-bold leading-[0.98] tracking-[-0.02em]">
        Because of <Link className="hover:opacity-70" href={sourceHref}>{group?.sourceTitle ?? "this title"}</Link>
      </h1>
    </section>

    <section className="page-width">
      {!group || group.rows.length === 0
        ? <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
          <h2 className="m-0 text-[22px] font-[650] leading-[1.12] tracking-[-0.02em]">All caught up</h2>
          <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">There&apos;s nothing new here right now.</p>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-full border border-line bg-bg px-5 py-2 text-sm font-semibold text-ink hover:bg-soft" href="/updates">Back to Updates</Link>
        </div>
        : cards === null
          ? <CatalogError />
          : <div className="grid grid-cols-[repeat(auto-fill,148px)] justify-center gap-x-3 gap-y-6 max-[480px]:grid-cols-2">
            {group.rows.map((row) => {
              const card = cards.get(`${row.mediaType}-${row.tmdbId}`);
              if (!card) return null;
              return <div className="flex min-w-0 flex-col items-center gap-2" key={row.id}>
                <FilmCard badge={badgeFor(row)} movie={card} />
                <DismissUpdateButton id={row.id} />
              </div>;
            })}
          </div>}
    </section>
  </main>;
}
