"use server";

import { revalidatePath } from "next/cache";
import { writeContentPreferences } from "@/lib/content-preferences";

export type ContentPreferencesState = { status: "idle" | "error"; message?: string };

export async function updateContentPreferencesAction(_previous: ContentPreferencesState, formData: FormData): Promise<ContentPreferencesState> {
  const preferEnglishOriginalLanguage = formData.get("preferEnglishOriginalLanguage") === "on";
  try {
    await writeContentPreferences({ preferEnglishOriginalLanguage });
    revalidatePath("/", "layout");
    return { status: "idle" };
  } catch {
    return { status: "error", message: "Couldn’t save your preferences. Try again." };
  }
}
