import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import { getCollectionParts, getMovieCollectionId, getTvDetails, isTmdbNotFound } from "@/lib/tmdb";
import { readFavorites } from "@/lib/favorites";
import { readRatings } from "@/lib/ratings";
import { readWatchlist } from "@/lib/watchlist";
import type { MediaType } from "@/types/tmdb";

export type FranchiseUpdateRow = {
  id: string;
  mediaType: MediaType;
  sourceTitle: string;
  // Absent on rows written before this field existed — the page falls back to
  // grouping/linking by sourceTitle alone for those.
  sourceTmdbId?: number;
  tmdbId: number;
  title: string;
  seasonNumber?: number;
  releaseDate: string | null;
  discoveredAt: string;
  dismissed: boolean;
};

type FranchiseUpdatesFile = { rows: FranchiseUpdateRow[] };

type FranchiseState = {
  checkedAt: string;
  collections: Record<string, { knownPartIds: number[] }>;
  shows: Record<string, { knownSeasonNumbers: number[] }>;
  // Set once the first checkFranchiseUpdates() run under the age-based
  // default has reconciled every already-tracked show's stale snapshot.
  seasonBaselineBackfilledAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const UPDATES_PATH = path.join(DATA_DIR, "franchise-updates.json");
const STATE_PATH = path.join(DATA_DIR, "franchise-state.json");

function isFranchiseUpdatesFile(value: unknown): value is FranchiseUpdatesFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as FranchiseUpdatesFile;
  return Array.isArray(data.rows) && data.rows.every((row) => (
    typeof row.id === "string"
    && (row.mediaType === "movie" || row.mediaType === "tv")
    && typeof row.tmdbId === "number"
    && typeof row.title === "string"
    && typeof row.dismissed === "boolean"
  ));
}

function isFranchiseState(value: unknown): value is FranchiseState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as FranchiseState;
  return typeof data.checkedAt === "string" && typeof data.collections === "object" && typeof data.shows === "object";
}

async function readFranchiseUpdates(): Promise<FranchiseUpdatesFile> {
  return readJsonFile(UPDATES_PATH, { rows: [] }, isFranchiseUpdatesFile, "franchise updates data");
}

async function readFranchiseState(): Promise<FranchiseState> {
  return readJsonFile(STATE_PATH, { checkedAt: "", collections: {}, shows: {} }, isFranchiseState, "franchise state data");
}

// Sorts newest/upcoming releases first; undated entries (TBA) sort last
// rather than first, since a real date is more actionable than a placeholder.
function byReleaseDateDesc(a: { releaseDate: string | null }, b: { releaseDate: string | null }): number {
  return (b.releaseDate ?? "0000-00-00").localeCompare(a.releaseDate ?? "0000-00-00");
}

export type FranchiseUpdateGroup = {
  key: string;
  mediaType: MediaType;
  sourceTitle: string;
  sourceTmdbId: number | null;
  isFavorite: boolean;
  rows: FranchiseUpdateRow[];
};

function groupKey(row: Pick<FranchiseUpdateRow, "mediaType" | "sourceTitle" | "sourceTmdbId">): string {
  return row.sourceTmdbId !== undefined ? `${row.mediaType}:${row.sourceTmdbId}` : `${row.mediaType}:title:${row.sourceTitle}`;
}

function groupBySource(rows: FranchiseUpdateRow[], favoriteKeys: Set<string>): FranchiseUpdateGroup[] {
  const groups = new Map<string, FranchiseUpdateGroup>();

  for (const row of rows) {
    const key = groupKey(row);
    let group = groups.get(key);
    if (!group) {
      const isFavorite = row.sourceTmdbId !== undefined && favoriteKeys.has(`${row.mediaType}-${row.sourceTmdbId}`);
      group = { key, mediaType: row.mediaType, sourceTitle: row.sourceTitle, sourceTmdbId: row.sourceTmdbId ?? null, isFavorite, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  for (const group of groups.values()) group.rows.sort(byReleaseDateDesc);
  return [...groups.values()].sort((a, b) => byReleaseDateDesc(a.rows[0], b.rows[0]));
}

export async function listFranchiseUpdateGroups(): Promise<FranchiseUpdateGroup[]> {
  const [{ rows }, { rows: favoriteRows }] = await Promise.all([readFranchiseUpdates(), readFavorites()]);
  const favoriteKeys = new Set(favoriteRows.map((row) => `${row.mediaType}-${row.tmdbId}`));
  return groupBySource(rows.filter((row) => !row.dismissed), favoriteKeys);
}

export async function getFranchiseUpdateGroup(mediaType: MediaType, sourceTmdbId: number): Promise<FranchiseUpdateGroup | null> {
  const groups = await listFranchiseUpdateGroups();
  return groups.find((group) => group.mediaType === mediaType && group.sourceTmdbId === sourceTmdbId) ?? null;
}

export async function dismissFranchiseUpdate(id: string): Promise<FranchiseUpdateRow | null> {
  const data = await readFranchiseUpdates();
  const row = data.rows.find((candidate) => candidate.id === id);
  if (!row) return null;
  row.dismissed = true;
  await writeJsonFileAtomic(UPDATES_PATH, data);
  return row;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// A rating/watchlist entry covers a whole series, not individual seasons, so
// there's no ground truth for "which seasons has this person actually seen."
// Seasons older than a year are assumed already watched by the time a show
// got tracked; anything more recent is surfaced so a real season the person
// hasn't gotten to yet doesn't silently disappear into "known" on first sight.
// This is only ever the *default* — setSeasonBaseline lets the person state
// their actual progress on a show's own page, which takes precedence.
function oneYearAgoIso(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function isOldSeason(airDate: string | null, cutoff: string): boolean {
  return airDate !== null && airDate < cutoff;
}

function seasonUpdateRow(showId: number, showTitle: string, season: { seasonNumber: number; airDate: string | null }, now: string): FranchiseUpdateRow {
  return {
    id: `tv:${showId}:${season.seasonNumber}`,
    mediaType: "tv",
    sourceTitle: showTitle,
    sourceTmdbId: showId,
    tmdbId: showId,
    title: showTitle,
    seasonNumber: season.seasonNumber,
    releaseDate: season.airDate,
    discoveredAt: now,
    dismissed: false,
  };
}

export type SeasonBaselineChoice = { type: "caught_up" } | { type: "recent" } | { type: "through"; seasonNumber: number };

// Lets someone state their actual progress on a show (from its own page)
// instead of relying on the age-based default. Seasons at or under the stated
// baseline are marked known — dismissing any already-surfaced update rows for
// them — while seasons above it are (re)surfaced immediately, since stating a
// baseline is itself a correction ("no, I haven't seen that one yet").
export async function setSeasonBaseline(showId: number, showTitle: string, choice: SeasonBaselineChoice): Promise<void> {
  const detail = await getTvDetails(showId);
  const cutoff = oneYearAgoIso();

  const known = new Set(
    choice.type === "caught_up" ? detail.seasons.map((season) => season.seasonNumber)
      : choice.type === "through" ? detail.seasons.filter((season) => season.seasonNumber <= choice.seasonNumber).map((season) => season.seasonNumber)
        : detail.seasons.filter((season) => isOldSeason(season.airDate, cutoff)).map((season) => season.seasonNumber),
  );

  const state = await readFranchiseState();
  state.shows[showId] = { knownSeasonNumbers: detail.seasons.map((season) => season.seasonNumber) };
  await writeJsonFileAtomic(STATE_PATH, state);

  const updatesFile = await readFranchiseUpdates();
  const byId = new Map(updatesFile.rows.map((row) => [row.id, row]));
  const now = new Date().toISOString();

  for (const season of detail.seasons) {
    const id = `tv:${showId}:${season.seasonNumber}`;
    const existing = byId.get(id);

    if (known.has(season.seasonNumber)) {
      if (existing) existing.dismissed = true;
    } else if (existing) {
      existing.dismissed = false;
    } else {
      const row = seasonUpdateRow(showId, showTitle, season, now);
      updatesFile.rows.push(row);
      byId.set(id, row);
    }
  }

  await writeJsonFileAtomic(UPDATES_PATH, updatesFile);
}

async function trackedItems(): Promise<Array<{ mediaType: MediaType; tmdbId: number; title: string }>> {
  const [{ rows: ratingRows }, { rows: watchlistRows }] = await Promise.all([readRatings(), readWatchlist()]);
  const byKey = new Map<string, { mediaType: MediaType; tmdbId: number; title: string }>();

  for (const row of [...watchlistRows, ...ratingRows]) {
    if (row.tmdbId === null) continue;
    byKey.set(`${row.mediaType}-${row.tmdbId}`, { mediaType: row.mediaType, tmdbId: row.tmdbId, title: row.title });
  }
  return [...byKey.values()];
}

// Checks every rated/watchlisted movie's TMDb collection and every rated/
// watchlisted show's season list for entries not seen on a previous check,
// and appends any it finds to the update feed.
//
// The first time a collection or show is seen, its *already-tracked* movies
// (for a collection) are treated as known so they don't get flagged, but any
// other existing parts are surfaced as "new for you" — sequels that already
// exist but the user may not know about. A show's seasons use the same
// backlog-surfacing shape, seeded from the age-based default (see
// oneYearAgoIso) rather than tracked ids, since seasons aren't individually
// rated/watchlisted — setSeasonBaseline lets that default be overridden.
export async function checkFranchiseUpdates(): Promise<{ added: number }> {
  const items = await trackedItems();
  const state = await readFranchiseState();
  const updatesFile = await readFranchiseUpdates();
  const existingIds = new Set(updatesFile.rows.map((row) => row.id));
  const now = new Date().toISOString();
  const newRows: FranchiseUpdateRow[] = [];

  const trackedMovies = items.filter((item) => item.mediaType === "movie");
  const trackedTmdbIdsByCollection = new Map<number, Set<number>>();
  const collectionSource = new Map<number, { title: string; tmdbId: number }>();

  await mapWithConcurrency(trackedMovies, 5, async (movie) => {
    const collection = await getMovieCollectionId(movie.tmdbId).catch((error) => {
      if (isTmdbNotFound(error)) return null;
      throw error;
    });
    if (!collection) return;
    if (!trackedTmdbIdsByCollection.has(collection.id)) trackedTmdbIdsByCollection.set(collection.id, new Set());
    trackedTmdbIdsByCollection.get(collection.id)!.add(movie.tmdbId);
    if (!collectionSource.has(collection.id)) collectionSource.set(collection.id, { title: movie.title, tmdbId: movie.tmdbId });
  });

  await mapWithConcurrency([...trackedTmdbIdsByCollection.entries()], 5, async ([collectionId, trackedIds]) => {
    const parts = await getCollectionParts(collectionId);
    const previouslyKnown = state.collections[collectionId]?.knownPartIds;
    const known = new Set(previouslyKnown ?? trackedIds);

    for (const part of parts) {
      if (known.has(part.tmdbId)) continue;
      const id = `movie:${part.tmdbId}`;
      if (!existingIds.has(id)) {
        newRows.push({
          id,
          mediaType: "movie",
          sourceTitle: collectionSource.get(collectionId)?.title ?? "",
          sourceTmdbId: collectionSource.get(collectionId)?.tmdbId,
          tmdbId: part.tmdbId,
          title: part.title,
          releaseDate: part.releaseDate,
          discoveredAt: now,
          dismissed: false,
        });
      }
    }

    state.collections[collectionId] = { knownPartIds: parts.map((part) => part.tmdbId) };
  });

  // Shows tracked before the age-based default existed already have a
  // knownSeasonNumbers snapshot recorded (from the old "mark everything known
  // on first sight" behavior) — trusting it as-is would grandfather those
  // shows forever, since previouslyKnown would always win over the default.
  // Until the one-time reconciliation below completes, an existing snapshot
  // is treated the same as no snapshot: recomputed from the age cutoff, not
  // trusted outright. Already-dismissed update ids still aren't recreated.
  const backfillPending = !state.seasonBaselineBackfilledAt;

  const trackedShows = items.filter((item) => item.mediaType === "tv");
  await mapWithConcurrency(trackedShows, 5, async (show) => {
    const detail = await getTvDetails(show.tmdbId).catch((error) => {
      if (isTmdbNotFound(error)) return null;
      throw error;
    });
    if (!detail) return;

    const cutoff = oneYearAgoIso();
    const previouslyKnown = state.shows[show.tmdbId]?.knownSeasonNumbers;
    const trustPriorKnown = previouslyKnown !== undefined && !backfillPending;
    const known = new Set(trustPriorKnown ? previouslyKnown : detail.seasons.filter((season) => isOldSeason(season.airDate, cutoff)).map((season) => season.seasonNumber));

    for (const season of detail.seasons) {
      if (known.has(season.seasonNumber)) continue;
      const id = `tv:${show.tmdbId}:${season.seasonNumber}`;
      if (!existingIds.has(id)) newRows.push(seasonUpdateRow(show.tmdbId, show.title, season, now));
    }

    state.shows[show.tmdbId] = { knownSeasonNumbers: detail.seasons.map((season) => season.seasonNumber) };
  });

  if (backfillPending) state.seasonBaselineBackfilledAt = now;
  if (newRows.length > 0) await writeJsonFileAtomic(UPDATES_PATH, { rows: [...updatesFile.rows, ...newRows] });
  await writeJsonFileAtomic(STATE_PATH, { ...state, checkedAt: now });
  return { added: newRows.length };
}
