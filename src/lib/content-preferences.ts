import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import type { MediaItem } from "@/types/tmdb";

export type ContentPreferences = { preferEnglishOriginalLanguage: boolean };

const DEFAULT_PREFERENCES: ContentPreferences = { preferEnglishOriginalLanguage: true };
const PREFERENCES_PATH = path.join(process.cwd(), "data", "content-preferences.json");

function isContentPreferences(value: unknown): value is ContentPreferences {
  return !!value
    && typeof value === "object"
    && typeof (value as ContentPreferences).preferEnglishOriginalLanguage === "boolean";
}

export async function readContentPreferences(): Promise<ContentPreferences> {
  return readJsonFile(PREFERENCES_PATH, DEFAULT_PREFERENCES, isContentPreferences, "content preferences");
}

export async function writeContentPreferences(preferences: ContentPreferences): Promise<void> {
  await writeJsonFileAtomic(PREFERENCES_PATH, preferences);
}

// A title receives a 20%-of-list-position boost. This elevates preferred
// language titles while preserving exceptionally strong results in other
// languages and never removes anything from the returned list.
export function prioritizeMediaItems<T extends MediaItem>(items: T[], preferences: ContentPreferences): T[] {
  if (!preferences.preferEnglishOriginalLanguage || items.length < 2) return items;
  return items
    .map((item, index) => ({
      item,
      score: 1 - index / items.length + (item.originalLanguageCode === "en" ? 0.2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export function languagePreferenceBoost(item: MediaItem, preferences: ContentPreferences): number {
  return preferences.preferEnglishOriginalLanguage && item.originalLanguageCode === "en" ? 0.025 : 0;
}
