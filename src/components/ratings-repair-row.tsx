"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { repairRowAction, type RepairState } from "@/lib/ratings-actions";
import type { MediaType } from "@/types/tmdb";

const initialState: RepairState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-md bg-ink px-3 py-1 text-xs font-semibold text-bg disabled:cursor-wait disabled:opacity-60 max-[480px]:order-4 max-[480px]:w-full" disabled={pending} type="submit">
    {pending ? "Fixing…" : "Fix"}
  </button>;
}

export function RatingsRepairRow({ imdbId, mediaType, title }: { imdbId: string; mediaType: MediaType; title: string }) {
  const [state, formAction] = useActionState(repairRowAction, initialState);

  return <form className="rounded-lg border border-line bg-bg px-3 py-2" action={formAction}>
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="imdbId" value={imdbId} />
      <input type="hidden" name="mediaType" value={mediaType} />
      <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-semibold uppercase text-muted">{mediaType}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{title}</span>
      <input className="min-h-11 w-40 rounded-md border border-line bg-soft px-2 py-1 text-xs text-ink max-[760px]:text-base max-[480px]:order-3 max-[480px]:w-full" name="query" placeholder="TMDb ID or title" type="text" />
      <SubmitButton />
    </div>
    {state.status === "error" ? <p className="mt-1.5 text-xs text-danger" role="alert">{state.message}</p> : null}
  </form>;
}
