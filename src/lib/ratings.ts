import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import { findMovieByImdbId, findTvByImdbId } from "@/lib/tmdb";
import type { MediaType } from "@/types/tmdb";

export type RatingRow = {
  imdbId: string;
  tmdbId: number | null;
  mediaType: MediaType;
  rating: number;
  title: string;
  matchedAt: string | null;
  ratedAt: string | null;
};

export type RatingsFile = {
  rows: RatingRow[];
  importedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");

function isRatingsFile(value: unknown): value is RatingsFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as RatingsFile;
  return typeof data.importedAt === "string" && Array.isArray(data.rows) && data.rows.every((row) => (
    typeof row.imdbId === "string"
    && (row.tmdbId === null || typeof row.tmdbId === "number")
    && (row.mediaType === "movie" || row.mediaType === "tv")
    && typeof row.rating === "number"
    && typeof row.title === "string"
  ));
}

export async function readRatings(): Promise<RatingsFile> {
  return readJsonFile(RATINGS_PATH, { rows: [], importedAt: "" }, isRatingsFile, "ratings data");
}

export async function writeRatings(data: RatingsFile): Promise<void> {
  await writeJsonFileAtomic(RATINGS_PATH, data);
}

export async function clearRatings(): Promise<void> {
  await writeRatings({ rows: [], importedAt: "" });
}

export async function updateRatingRow(imdbId: string, tmdbId: number | null): Promise<void> {
  const data = await readRatings();
  const row = data.rows.find((candidate) => candidate.imdbId === imdbId);
  if (!row) return;

  row.tmdbId = tmdbId;
  row.matchedAt = tmdbId ? new Date().toISOString() : null;
  await writeRatings(data);
}

// A fresh IMDb export is a full snapshot, so re-importing should replace the
// rating/title/mediaType for every row from that snapshot. But a row that was
// already matched — whether auto-matched last time or fixed by hand via the
// repair form — should keep that match if the fresh auto-match attempt fails
// (e.g. a transient TMDb error), so re-importing never silently undoes a
// manual repair.
export async function mergeRatings(freshRows: RatingRow[]): Promise<RatingsFile> {
  const existing = await readRatings();
  const previousByImdbId = new Map(existing.rows.map((row) => [row.imdbId, row]));

  const rows = freshRows.map((row) => {
    const previous = previousByImdbId.get(row.imdbId);
    if (row.tmdbId !== null || !previous || previous.tmdbId === null) return row;
    return { ...row, tmdbId: previous.tmdbId, matchedAt: previous.matchedAt };
  });

  return { rows, importedAt: new Date().toISOString() };
}

// Quoted-field-aware CSV line parser (RFC 4180-ish). Does not handle embedded
// newlines inside quoted fields — IMDb's ratings export doesn't produce them.
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

// A "TV Movie" row lives in TMDb's movie catalog, not its TV catalog, so only
// the series/episode-shaped title types are matched against find/{imdb_id}'s
// tv_results. The ratings CSV export uses human-readable labels ("TV Series",
// "TV Mini Series", ...), not the lowercase-camelCase title types from IMDb's
// raw dataset — both are accepted here in case a differently-sourced CSV uses
// the dataset form instead.
const TV_TITLE_TYPES = new Set([
  "tv series", "tv mini series", "tv special", "tv episode", "tv short",
  "tvseries", "tvminiseries", "tvspecial", "tvepisode", "tvshort",
]);

function mediaTypeFromTitleType(titleType: string): MediaType {
  return TV_TITLE_TYPES.has(titleType.trim().toLowerCase()) ? "tv" : "movie";
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

// IMDb's ratings export columns (Const, Your Rating, Title, Title Type, ...) have
// shifted order and gained new columns (e.g. "Original Title") across export
// format revisions, so column positions are looked up by header name rather than
// hardcoded — the same export from a year apart shouldn't silently mis-map fields.
const REQUIRED_COLUMNS = ["Const", "Your Rating", "Title Type"] as const;

export async function importCsv(text: string): Promise<RatingRow[]> {
  const withoutBom = text.replace(/^﻿/, "");
  const lines = withoutBom.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const columnIndex = (name: string) => header.indexOf(name);
  if (REQUIRED_COLUMNS.some((name) => columnIndex(name) === -1)) return [];

  const imdbIdColumn = columnIndex("Const");
  const ratingColumn = columnIndex("Your Rating");
  const titleColumn = columnIndex("Title");
  const titleTypeColumn = columnIndex("Title Type");
  const dateRatedColumn = columnIndex("Date Rated");

  const parsedRows = lines.slice(1)
    .map(parseCsvLine)
    .filter((fields) => fields[imdbIdColumn]);

  // A ratings export shouldn't contain duplicate titles, but guard against a
  // malformed or hand-edited file re-listing the same imdbId more than once.
  const byImdbId = new Map<string, string[]>();
  for (const fields of parsedRows) byImdbId.set(fields[imdbIdColumn], fields);

  return mapWithConcurrency([...byImdbId.values()], 8, async (fields) => {
    const imdbId = fields[imdbIdColumn];
    const mediaType = mediaTypeFromTitleType(fields[titleTypeColumn] || "");
    const tmdbId = await (mediaType === "tv" ? findTvByImdbId(imdbId) : findMovieByImdbId(imdbId)).catch(() => null);
    return {
      imdbId,
      tmdbId,
      mediaType,
      rating: Number(fields[ratingColumn]) || 0,
      title: (titleColumn === -1 ? "" : fields[titleColumn]) || imdbId,
      matchedAt: tmdbId ? new Date().toISOString() : null,
      ratedAt: (dateRatedColumn === -1 ? "" : fields[dateRatedColumn]) || null,
    };
  });
}
