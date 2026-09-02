"use server";

import { revalidatePath } from "next/cache";
import { toggleFavorite } from "@/lib/favorites";
import type { MediaType } from "@/types/tmdb";

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const mediaType: MediaType = String(formData.get("mediaType")) === "tv" ? "tv" : "movie";
  const tmdbId = Number(formData.get("tmdbId"));
  const title = String(formData.get("title") ?? "");
  if (!Number.isInteger(tmdbId) || tmdbId < 1 || !title) return;

  await toggleFavorite(mediaType, tmdbId, title);
  revalidatePath(`/${mediaType === "tv" ? "tv" : "movies"}/${tmdbId}`);
  revalidatePath("/updates");
}
