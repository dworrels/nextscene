"use server";

import { revalidatePath } from "next/cache";
import { getMovieTitle, getTvShowName, isTmdbNotFound, searchMovieId, searchTvId } from "@/lib/tmdb";
import { readRatings } from "@/lib/ratings";
import { clearWatchlist, importCsv, mergeWatchlist, readWatchlist, updateWatchlistRow, watchlistStatus, writeWatchlist } from "@/lib/watchlist";
import type { MediaType } from "@/types/tmdb";

export type ImportState = { status: "idle" | "error"; message?: string };
export type RepairState = { status: "idle" | "error"; message?: string };

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function importWatchlistAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to import." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { status: "error", message: "That file is too large to be a watchlist export." };
  }

  let rows;
  try {
    const text = await file.text();
    rows = await importCsv(text);
  } catch {
    return { status: "error", message: "Something went wrong while reading that file. Try again." };
  }

  if (rows.length === 0) {
    return { status: "error", message: "No titles found. Export your watchlist from IMDb (Your watchlist → ⋯ → Export) and upload that CSV." };
  }

  // An episode can resolve to a series that was rated under the series' own
  // IMDb ID. Compare the canonical TMDb key as well as the original IMDb ID,
  // so watched titles never re-enter the saved list through that path.
  const { rows: ratingRows } = await readRatings();
  const ratedImdbIds = new Set(ratingRows.map((row) => row.imdbId));
  const ratedMediaKeys = new Set(ratingRows
    .filter((row) => row.tmdbId !== null)
    .map((row) => `${row.mediaType}-${row.tmdbId}`));
  const actionableRows = rows.filter((row) => (
    !ratedImdbIds.has(row.imdbId)
    && (row.tmdbId === null || !ratedMediaKeys.has(`${row.mediaType}-${row.tmdbId}`))
  ));

  const merged = await mergeWatchlist(actionableRows);
  await writeWatchlist(merged);
  revalidatePath("/", "layout");
  return { status: "idle" };
}

export async function deleteWatchlistAction(): Promise<void> {
  await clearWatchlist();
  revalidatePath("/", "layout");
}

export async function toggleWatchlistAction(formData: FormData): Promise<void> {
  const mediaType: MediaType = String(formData.get("mediaType")) === "tv" ? "tv" : "movie";
  const tmdbId = Number(formData.get("tmdbId"));
  const title = String(formData.get("title") ?? "");
  const imdbId = String(formData.get("imdbId") ?? "").trim() || `tmdb:${mediaType}:${tmdbId}`;
  const releaseDate = String(formData.get("releaseDate") ?? "").trim() || null;
  if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title) return;

  const data = await readWatchlist();
  const alreadySaved = data.rows.some((row) => row.mediaType === mediaType && row.tmdbId === tmdbId);

  const rows = alreadySaved
    ? data.rows.filter((row) => !(row.mediaType === mediaType && row.tmdbId === tmdbId))
    : [...data.rows, {
      imdbId,
      tmdbId,
      mediaType,
      title,
      matchedAt: new Date().toISOString(),
      addedAt: new Date().toISOString(),
      releaseDate,
      status: watchlistStatus(releaseDate ?? undefined),
      sourceTitleType: mediaType === "tv" ? "tv series" : "movie",
      resolvedFromEpisode: false,
    }];

  await writeWatchlist({ rows, importedAt: data.importedAt || new Date().toISOString() });
  revalidatePath("/", "layout");
}

async function tmdbIdExists(id: number, mediaType: "movie" | "tv"): Promise<boolean> {
  try {
    await (mediaType === "tv" ? getTvShowName(id) : getMovieTitle(id));
    return true;
  } catch (error) {
    if (isTmdbNotFound(error)) return false;
    throw error;
  }
}

export async function repairWatchlistRowAction(_prevState: RepairState, formData: FormData): Promise<RepairState> {
  const imdbId = String(formData.get("imdbId") ?? "");
  const mediaType = String(formData.get("mediaType") ?? "movie") === "tv" ? "tv" : "movie";
  const query = String(formData.get("query") ?? "").trim();
  if (!imdbId || !query) return { status: "error", message: "Enter a TMDb ID or a title to search." };

  try {
    let tmdbId: number | null;
    if (/^\d+$/.test(query)) {
      const candidate = Number(query);
      tmdbId = (await tmdbIdExists(candidate, mediaType)) ? candidate : null;
    } else {
      tmdbId = await (mediaType === "tv" ? searchTvId(query) : searchMovieId(query));
    }

    if (tmdbId === null) return { status: "error", message: "No match found. Try a different title or TMDb ID." };

    await updateWatchlistRow(imdbId, tmdbId);
    revalidatePath("/", "layout");
    return { status: "idle" };
  } catch {
    return { status: "error", message: "Something went wrong. Try again." };
  }
}
