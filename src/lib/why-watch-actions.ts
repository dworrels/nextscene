"use server";

import { getDetailedWhyWatchExplanation } from "@/lib/llm-recommendations";
import { getWhyWatchInsight, type WhyWatchInsight } from "@/lib/recommendations";
import { readRatings } from "@/lib/ratings";
import { getMovieDetails, getTvDetails } from "@/lib/tmdb";
import type { MediaItem, MediaType } from "@/types/tmdb";

export type WhyWatchState = {
  status: "idle" | "ready" | "rated" | "empty" | "error";
  insight?: WhyWatchInsight;
  explanation?: string;
  title?: string;
  rating?: number;
  message?: string;
};

function parseMediaType(value: FormDataEntryValue | null): MediaType | null {
  return value === "movie" || value === "tv" ? value : null;
}

// This is intentionally safe to render on the initial detail-page request: it
// uses only deterministic personal-fit signals and never invokes chat models.
export async function getInitialWhyWatchState(item: MediaItem): Promise<WhyWatchState> {
  try {
    const { rows } = await readRatings();
    const rating = rows.find((row) => row.tmdbId === item.id && row.mediaType === item.mediaType)?.rating;
    if (rating !== undefined) return { status: "rated", title: item.title, rating };

    const insight = await getWhyWatchInsight(item);
    if (!insight) return { status: "empty", message: "Import more matched ratings to build a personal explanation." };
    return { status: "ready", insight };
  } catch {
    return { status: "error", message: "Your personal rating estimate couldn't be calculated right now." };
  }
}

export async function whyWatchAction(_previous: WhyWatchState, formData: FormData): Promise<WhyWatchState> {
  const id = Number(formData.get("id"));
  const mediaType = parseMediaType(formData.get("mediaType"));
  const mode = formData.get("mode");
  if (!Number.isInteger(id) || id < 1 || !mediaType || mode !== "detailed") {
    return { status: "error", message: "That title could not be identified." };
  }

  try {
    const item = mediaType === "movie" ? await getMovieDetails(id) : await getTvDetails(id);
    const initial = await getInitialWhyWatchState(item);
    if (initial.status !== "ready" || !initial.insight) return initial;
    const explanation = await getDetailedWhyWatchExplanation(item, initial.insight);
    return { ...initial, explanation };
  } catch {
    return _previous.insight
      ? { ..._previous, status: "ready", message: "A detailed explanation isn't available right now." }
      : { status: "error", message: "A detailed explanation isn't available right now." };
  }
}
