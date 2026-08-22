import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import type { MediaType } from "@/types/tmdb";

export type FavoriteRow = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  addedAt: string;
};

export type FavoritesFile = { rows: FavoriteRow[] };

const DATA_DIR = path.join(process.cwd(), "data");
const FAVORITES_PATH = path.join(DATA_DIR, "favorites.json");

function isFavoritesFile(value: unknown): value is FavoritesFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as FavoritesFile;
  return Array.isArray(data.rows) && data.rows.every((row) => (
    typeof row.tmdbId === "number"
    && (row.mediaType === "movie" || row.mediaType === "tv")
    && typeof row.title === "string"
    && typeof row.addedAt === "string"
  ));
}

export async function readFavorites(): Promise<FavoritesFile> {
  return readJsonFile(FAVORITES_PATH, { rows: [] }, isFavoritesFile, "favorites data");
}

async function writeFavorites(data: FavoritesFile): Promise<void> {
  await writeJsonFileAtomic(FAVORITES_PATH, data);
}

export async function isFavorite(mediaType: MediaType, tmdbId: number): Promise<boolean> {
  const { rows } = await readFavorites();
  return rows.some((row) => row.mediaType === mediaType && row.tmdbId === tmdbId);
}

export async function toggleFavorite(mediaType: MediaType, tmdbId: number, title: string): Promise<void> {
  const data = await readFavorites();
  const alreadyFavorite = data.rows.some((row) => row.mediaType === mediaType && row.tmdbId === tmdbId);

  const rows = alreadyFavorite
    ? data.rows.filter((row) => !(row.mediaType === mediaType && row.tmdbId === tmdbId))
    : [...data.rows, { tmdbId, mediaType, title, addedAt: new Date().toISOString() }];

  await writeFavorites({ rows });
}
