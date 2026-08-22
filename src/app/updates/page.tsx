import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { CatalogError } from "@/components/catalog-state";
import { Arrow } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { UpdatesFilter } from "@/components/updates-filter";
import { refreshFranchiseUpdatesAction } from "@/lib/franchise-updates-actions";
import { listFranchiseUpdateGroups, type FranchiseUpdateGroup } from "@/lib/franchise-updates";
import { getMediaCards } from "@/lib/tmdb";
import type { MediaItem, MediaType } from "@/types/tmdb";

export const metadata: Metadata = { title: "Updates — NextScene" };

function subtitleFor(group: FranchiseUpdateGroup) {
  const count = group.rows.length;
  const noun = group.mediaType === "tv" ? "season" : "sequel";
  return `${count} new ${noun}${count === 1 ? "" : "s"}`;
}

function hasReleased(group: FranchiseUpdateGroup, today: string) {
  return group.rows.some((row) => row.releaseDate !== null && row.releaseDate <= today);
}

type Section = { slug: string; title: string; groups: FranchiseUpdateGroup[] };

function buildSections(groups: FranchiseUpdateGroup[]): Section[] {
  const today = new Date().toISOString().slice(0, 10);
  const favorites = groups.filter((group) => group.isFavorite);
  const rest = groups.filter((group) => !group.isFavorite);

  const byTypeAndStatus = (mediaType: MediaType, released: boolean) => rest.filter((group) => group.mediaType === mediaType && hasReleased(group, today) === released);

  return [
    { slug: "favorites", title: "Favorites", groups: favorites },
    { slug: "movies-out", title: "Movies out now", groups: byTypeAndStatus("movie", true) },
    { slug: "movies-later", title: "Movies coming later", groups: byTypeAndStatus("movie", false) },
    { slug: "tv-out", title: "TV shows out now", groups: byTypeAndStatus("tv", true) },
    { slug: "tv-later", title: "TV shows coming later", groups: byTypeAndStatus("tv", false) },
  ].filter((section) => section.groups.length > 0);
}

export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const groups = await listFranchiseUpdateGroups();
  const cards = groups.length > 0
    ? await getMediaCards(groups.flatMap((group) => group.sourceTmdbId !== null ? [{ id: group.sourceTmdbId, mediaType: group.mediaType }] : [])).catch(() => null)
    : new Map<string, MediaItem>();
  const sections = buildSections(groups);
  const activeSection = sections.find((section) => section.slug === tab) ?? sections[0];

  return <main className="pb-24">
    <SiteHeader />
    <section className="page-width pt-[84px] max-[760px]:pt-11 pb-10">
      <BackButton className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-soft text-ink hover:bg-line" fallbackHref="/" ariaLabel="Go back" />
      <div className="flex items-center justify-between gap-4 max-[600px]:flex-col max-[600px]:items-stretch">
        <h1 className="m-0 text-[clamp(36px,5vw,60px)] font-bold leading-[0.98] tracking-[-0.02em]">Updates</h1>
        <form action={refreshFranchiseUpdatesAction}>
          <button className="min-h-11 w-full rounded-full border border-line bg-soft px-5 py-2 text-sm font-semibold text-ink hover:bg-line min-[601px]:w-auto" type="submit">Check for updates</button>
        </form>
      </div>
      <p className="mt-4 text-sm text-muted">New sequels and seasons for movies and shows you&apos;ve rated or saved.</p>
    </section>

    <section className="page-width max-w-[1100px]">
      {groups.length === 0
        ? <div className="rounded-2xl bg-soft px-8 py-14 text-center max-[760px]:px-6 max-[760px]:py-10">
          <h2 className="m-0 text-[22px] font-[650] leading-[1.12] tracking-[-0.02em]">Nothing new right now</h2>
          <p className="mx-auto mt-3 max-w-[420px] text-sm text-muted">Rate or save titles, then check back — new sequels and seasons for them will show up here.</p>
        </div>
        : cards === null
          ? <CatalogError />
          : <>
            <UpdatesFilter
              options={sections.map((section) => ({ count: section.groups.length, slug: section.slug, title: section.title }))}
              value={activeSection.slug}
            />

            <div className="mb-6 hidden gap-2 pb-1 min-[760px]:flex min-[760px]:flex-wrap">
              {sections.map((section) => <Link
                className={`min-h-9 flex-none rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  section.slug === activeSection.slug ? "border-ink bg-ink text-bg" : "border-line bg-soft text-ink hover:bg-well"
                }`}
                href={`/updates?tab=${section.slug}`}
                key={section.slug}
              >
                {section.title} <span className="opacity-70">({section.groups.length})</span>
              </Link>)}
            </div>

            <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
              {activeSection.groups.map((group) => {
                const card = group.sourceTmdbId !== null ? cards.get(`${group.mediaType}-${group.sourceTmdbId}`) : undefined;
                const href = group.sourceTmdbId !== null ? `/updates/${group.mediaType}/${group.sourceTmdbId}` : "/updates";
                return <Link className="flex items-center gap-4 rounded-2xl border border-line bg-soft p-3 transition-colors hover:bg-well" href={href} key={group.key}>
                  <div className="relative h-[66px] w-11 flex-none overflow-hidden rounded-lg bg-well">
                    {card?.posterUrl ? <Image alt="" className="object-cover" fill sizes="44px" src={card.posterUrl} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-base font-semibold text-ink">{group.sourceTitle}</p>
                    <p className="m-0 mt-0.5 text-sm text-muted">{subtitleFor(group)}</p>
                  </div>
                  <Arrow />
                </Link>;
              })}
            </div>
          </>}
    </section>
  </main>;
}
