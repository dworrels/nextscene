import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { findMovieByImdbId, findTvByImdbId } from "@/lib/tmdb";
import type { MediaType } from "@/types/tmdb";

export type RatingRow = {
  imdbId: string;
  tmdbId: number | null;
  mediaType: MediaType;
  rating: number;
  title: string;
  matchedAt: string | null;
};

export type RatingsFile = {
  rows: RatingRow[];
  importedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");

export async function readRatings(): Promise<RatingsFile> {
  try {
    const text = await readFile(RATINGS_PATH, "utf-8");
    return JSON.parse(text) as RatingsFile;
  } catch {
    return { rows: [], importedAt: "" };
  }
}

export async function writeRatings(data: RatingsFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(RATINGS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function updateRatingRow(imdbId: string, tmdbId: number | null): Promise<void> {
  const data = await readRatings();
  const row = data.rows.find((candidate) => candidate.imdbId === imdbId);
  if (!row) return;

  row.tmdbId = tmdbId;
  row.matchedAt = tmdbId ? new Date().toISOString() : null;
  await writeRatings(data);
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

// IMDb ratings export columns: Const,Your Rating,Date Rated,Title,URL,Title Type,
// IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
const IMDB_ID_COLUMN = 0;
const RATING_COLUMN = 1;
const TITLE_COLUMN = 3;
const TITLE_TYPE_COLUMN = 5;

// tvMovie rows live in TMDb's movie catalog, not its TV catalog, so only the
// series-shaped title types should be matched against find/{imdb_id}'s tv_results.
function mediaTypeFromTitleType(titleType: string): MediaType {
  return titleType === "tvSeries" || titleType === "tvMiniSeries" ? "tv" : "movie";
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

export async function importCsv(text: string): Promise<RatingRow[]> {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const rows = lines.slice(1)
    .map(parseCsvLine)
    .filter((fields) => fields[IMDB_ID_COLUMN]);

  return mapWithConcurrency(rows, 8, async (fields) => {
    const imdbId = fields[IMDB_ID_COLUMN];
    const mediaType = mediaTypeFromTitleType(fields[TITLE_TYPE_COLUMN] || "");
    const tmdbId = await (mediaType === "tv" ? findTvByImdbId(imdbId) : findMovieByImdbId(imdbId)).catch(() => null);
    return {
      imdbId,
      tmdbId,
      mediaType,
      rating: Number(fields[RATING_COLUMN]) || 0,
      title: fields[TITLE_COLUMN] || imdbId,
      matchedAt: tmdbId ? new Date().toISOString() : null,
    };
  });
}
