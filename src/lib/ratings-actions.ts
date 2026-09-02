"use server";

import { revalidatePath } from "next/cache";
import { clearRatings, importCsv, mergeRatings, rateMedia, unrateMedia, updateRatingRow, writeRatings } from "@/lib/ratings";
import { getMovieTitle, getTvShowName, isTmdbNotFound, searchMovieId, searchTvId } from "@/lib/tmdb";
import type { MediaType } from "@/types/tmdb";

export type ImportState = { status: "idle" | "error"; message?: string };
export type RepairState = { status: "idle" | "error"; message?: string };

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function importRatingsAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to import." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { status: "error", message: "That file is too large to be a ratings export." };
  }

  let rows;
  try {
    const text = await file.text();
    rows = await importCsv(text);
  } catch {
    return { status: "error", message: "Something went wrong while reading that file. Try again." };
  }

  if (rows.length === 0) {
    return { status: "error", message: "No ratings found. Export your ratings from IMDb (Your ratings → ⋯ → Export) and upload that CSV." };
  }

  const merged = await mergeRatings(rows);
  await writeRatings(merged);
  // Every page's "why you'll like this" / predicted-rating content is
  // derived from ratings.json, but pages are ISR-cached for an hour
  // (see `export const revalidate = 3600`) — without this, a rating change
  // wouldn't be reflected anywhere on the site until that cache expired.
  // "layout" revalidates every route under the root layout, not just "/".
  revalidatePath("/", "layout");
  return { status: "idle" };
}

export async function deleteRatingsAction(): Promise<void> {
  await clearRatings();
  revalidatePath("/", "layout");
}

// Backs RatingControl on movie/tv detail pages — rates a title in-app
// (whether it's new or already carries an imported IMDb rating). A missing
// or zero rating clears any existing one instead, so clicking the currently
// selected star un-rates a title.
export async function rateMediaAction(formData: FormData): Promise<void> {
  const mediaType: MediaType = String(formData.get("mediaType")) === "tv" ? "tv" : "movie";
  const tmdbId = Number(formData.get("tmdbId"));
  const title = String(formData.get("title") ?? "");
  if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title) return;

  const rating = Number(formData.get("rating"));
  if (formData.get("rating") === null || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    await unrateMedia(mediaType, tmdbId);
  } else {
    await rateMedia({ mediaType, tmdbId, title, rating });
  }
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

export async function repairRowAction(_prevState: RepairState, formData: FormData): Promise<RepairState> {
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

    await updateRatingRow(imdbId, tmdbId);
    revalidatePath("/", "layout");
    return { status: "idle" };
  } catch {
    return { status: "error", message: "Something went wrong. Try again." };
  }
}
