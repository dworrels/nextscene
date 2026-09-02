"use server";

import { revalidatePath } from "next/cache";
import { checkFranchiseUpdates, dismissFranchiseUpdate, setSeasonBaseline, type SeasonBaselineChoice } from "@/lib/franchise-updates";

export async function refreshFranchiseUpdatesAction(): Promise<void> {
  await checkFranchiseUpdates();
  revalidatePath("/updates");
}

export async function dismissFranchiseUpdateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const row = await dismissFranchiseUpdate(id);
  revalidatePath("/updates");
  if (row && row.sourceTmdbId !== undefined) revalidatePath(`/updates/${row.mediaType}/${row.sourceTmdbId}`);
}

// The picker on a show's page posts a single "baseline" value ("caught_up",
// "recent", or "through:<seasonNumber>") rather than separate fields, since
// it's one <select> with one submit button.
export async function setSeasonBaselineAction(formData: FormData): Promise<void> {
  const showId = Number(formData.get("showId"));
  const showTitle = String(formData.get("showTitle") ?? "");
  const baseline = String(formData.get("baseline") ?? "");
  if (!Number.isInteger(showId) || showId < 1 || !showTitle) return;

  const [mode, rawSeasonNumber] = baseline.split(":");
  const choice: SeasonBaselineChoice | null =
    mode === "caught_up" ? { type: "caught_up" }
      : mode === "recent" ? { type: "recent" }
        : mode === "through" && Number.isInteger(Number(rawSeasonNumber)) ? { type: "through", seasonNumber: Number(rawSeasonNumber) }
          : null;
  if (!choice) return;

  await setSeasonBaseline(showId, showTitle, choice);
  revalidatePath("/updates");
  revalidatePath(`/tv/${showId}`);
}
