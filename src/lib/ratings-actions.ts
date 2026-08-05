"use server";

import { revalidatePath } from "next/cache";
import { importCsv, updateRatingRow, writeRatings } from "@/lib/ratings";
import { searchMovieId } from "@/lib/tmdb";

export async function importRatingsAction(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const text = await file.text();
  const rows = await importCsv(text);
  await writeRatings({ rows, importedAt: new Date().toISOString() });
  revalidatePath("/");
}

export async function repairRowAction(formData: FormData): Promise<void> {
  const imdbId = String(formData.get("imdbId") ?? "");
  const query = String(formData.get("query") ?? "").trim();
  if (!imdbId || !query) return;

  const tmdbId = /^\d+$/.test(query) ? Number(query) : await searchMovieId(query);
  await updateRatingRow(imdbId, tmdbId);
  revalidatePath("/");
}
