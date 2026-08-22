import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import { getTvShowName, isEpisodeTitleType, mediaTypeFromTitleType, normalizedTitleType, resolveImdbTitle } from "@/lib/tmdb";
import type { MediaType } from "@/types/tmdb";

export type WatchlistStatus = "available" | "upcoming" | "metadata_pending";

export type WatchlistRow = {
  imdbId: string;
  tmdbId: number | null;
  mediaType: MediaType;
  title: string;
  matchedAt: string | null;
  addedAt: string | null;
  releaseDate?: string | null;
  status?: WatchlistStatus;
  sourceTitleType?: string;
  resolvedFromEpisode?: boolean;
};

export type WatchlistFile = {
  rows: WatchlistRow[];
  importedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const WATCHLIST_PATH = path.join(DATA_DIR, "watchlist.json");

function isWatchlistFile(value: unknown): value is WatchlistFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as WatchlistFile;
  return typeof data.importedAt === "string" && Array.isArray(data.rows) && data.rows.every((row) => (
    typeof row.imdbId === "string"
    && (row.tmdbId === null || typeof row.tmdbId === "number")
    && (row.mediaType === "movie" || row.mediaType === "tv")
    && typeof row.title === "string"
    && (row.releaseDate === undefined || row.releaseDate === null || typeof row.releaseDate === "string")
    && (row.status === undefined || row.status === "available" || row.status === "upcoming" || row.status === "metadata_pending")
    && (row.sourceTitleType === undefined || typeof row.sourceTitleType === "string")
    && (row.resolvedFromEpisode === undefined || typeof row.resolvedFromEpisode === "boolean")
  ));
}

export async function readWatchlist(): Promise<WatchlistFile> {
  return readJsonFile(WATCHLIST_PATH, { rows: [], importedAt: "" }, isWatchlistFile, "watchlist data");
}

export async function writeWatchlist(data: WatchlistFile): Promise<void> {
  await writeJsonFileAtomic(WATCHLIST_PATH, data);
}

export async function clearWatchlist(): Promise<void> {
  await writeWatchlist({ rows: [], importedAt: "" });
}

export async function isInWatchlist(mediaType: MediaType, tmdbId: number): Promise<boolean> {
  const { rows } = await readWatchlist();
  return rows.some((row) => row.mediaType === mediaType && row.tmdbId === tmdbId);
}

export async function updateWatchlistRow(imdbId: string, tmdbId: number | null): Promise<void> {
  const data = await readWatchlist();
  const row = data.rows.find((candidate) => candidate.imdbId === imdbId);
  if (!row) return;

  row.tmdbId = tmdbId;
  row.matchedAt = tmdbId ? new Date().toISOString() : null;
  await writeWatchlist(data);
}

// Same reasoning as ratings' mergeRatings: a fresh watchlist export is a full
// snapshot, but a row that was already matched (auto or manually repaired)
// should keep that match if the fresh auto-match attempt fails, so re-importing
// never silently undoes a manual repair.
export async function mergeWatchlist(freshRows: WatchlistRow[]): Promise<WatchlistFile> {
  const existing = await readWatchlist();
  const previousByImdbId = new Map(existing.rows.map((row) => [row.imdbId, row]));

  const repairedRows = freshRows.map((row) => {
    const previous = previousByImdbId.get(row.imdbId);
    if (row.tmdbId !== null || !previous || previous.tmdbId === null) return row;
    return { ...row, tmdbId: previous.tmdbId, matchedAt: previous.matchedAt };
  });

  // Several IMDb episode records can point to one show. Store that show only
  // once, preferring a direct series record when the export contains both.
  const rows: WatchlistRow[] = [];
  const rowIndexByMediaKey = new Map<string, number>();
  for (const row of repairedRows) {
    const mediaKey = row.tmdbId === null ? null : `${row.mediaType}-${row.tmdbId}`;
    if (mediaKey === null || !rowIndexByMediaKey.has(mediaKey)) {
      if (mediaKey !== null) rowIndexByMediaKey.set(mediaKey, rows.length);
      rows.push(row);
      continue;
    }

    const existingIndex = rowIndexByMediaKey.get(mediaKey) as number;
    if (rows[existingIndex].resolvedFromEpisode && !row.resolvedFromEpisode) rows[existingIndex] = row;
  }

  return { rows, importedAt: new Date().toISOString() };
}

// Quoted-field-aware CSV line parser (RFC 4180-ish). Does not handle embedded
// newlines inside quoted fields — IMDb's list exports don't produce them.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else current += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const UNSUPPORTED_TITLE_TYPES = new Set(["video game", "videogame"]);

function isSupportedTitleType(titleType: string): boolean {
  return !UNSUPPORTED_TITLE_TYPES.has(normalizedTitleType(titleType));
}

export function watchlistStatus(releaseDate: string | undefined): WatchlistStatus {
  if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return "metadata_pending";
  return releaseDate > new Date().toISOString().slice(0, 10) ? "upcoming" : "available";
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

// Column positions are looked up by header name rather than hardcoded — see
// ratings.ts for why. Some IMDb list exports include a "Your Rating" column;
// those entries are watched history, not actionable watchlist titles.
const REQUIRED_COLUMNS = ["Const", "Title Type"] as const;

export async function importCsv(text: string): Promise<WatchlistRow[]> {
  const withoutBom = text.replace(/^﻿/, "");
  const lines = withoutBom.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const columnIndex = (name: string) => header.indexOf(name);
  if (REQUIRED_COLUMNS.some((name) => columnIndex(name) === -1)) return [];

  const imdbIdColumn = columnIndex("Const");
  const titleColumn = columnIndex("Title");
  const titleTypeColumn = columnIndex("Title Type");
  const createdColumn = columnIndex("Created");
  const releaseDateColumn = columnIndex("Release Date");
  const ratingColumn = columnIndex("Your Rating");

  const parsedRows = lines.slice(1)
    .map(parseCsvLine)
    .filter((fields) => fields[imdbIdColumn])
    .filter((fields) => isSupportedTitleType(fields[titleTypeColumn] || ""))
    .filter((fields) => ratingColumn === -1 || !fields[ratingColumn]?.trim());

  // A watchlist export shouldn't contain duplicate titles, but guard against a
  // malformed or hand-edited file re-listing the same imdbId more than once.
  const byImdbId = new Map<string, string[]>();
  for (const fields of parsedRows) byImdbId.set(fields[imdbIdColumn], fields);

  return mapWithConcurrency([...byImdbId.values()], 8, async (fields) => {
    const imdbId = fields[imdbIdColumn];
    const sourceTitleType = fields[titleTypeColumn] || "";
    const resolvesEpisode = isEpisodeTitleType(sourceTitleType);
    const match = await resolveImdbTitle(imdbId, resolvesEpisode, mediaTypeFromTitleType(sourceTitleType) === "tv");
    const tmdbId = match?.tmdbId ?? null;
    const mediaType = match?.mediaType ?? mediaTypeFromTitleType(sourceTitleType);
    const sourceTitle = (titleColumn === -1 ? "" : fields[titleColumn]) || imdbId;
    const title = resolvesEpisode && mediaType === "tv" && tmdbId !== null
      ? await getTvShowName(tmdbId).catch(() => sourceTitle)
      : sourceTitle;
    const releaseDate = (releaseDateColumn === -1 ? "" : fields[releaseDateColumn]) || null;
    return {
      imdbId,
      tmdbId,
      mediaType,
      title,
      matchedAt: tmdbId ? new Date().toISOString() : null,
      addedAt: (createdColumn === -1 ? "" : fields[createdColumn]) || null,
      releaseDate,
      status: watchlistStatus(releaseDate ?? undefined),
      sourceTitleType,
      resolvedFromEpisode: resolvesEpisode,
    };
  });
}
