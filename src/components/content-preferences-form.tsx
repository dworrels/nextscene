"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateContentPreferencesAction, type ContentPreferencesState } from "@/lib/content-preferences-actions";

const initialState: ContentPreferencesState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Save preferences"}</button>;
}

export function ContentPreferencesForm({ preferEnglishOriginalLanguage }: { preferEnglishOriginalLanguage: boolean }) {
  const [state, formAction] = useActionState(updateContentPreferencesAction, initialState);
  return <form action={formAction} className="rounded-2xl border border-line bg-soft px-6 py-6">
    <label className="flex cursor-pointer items-start gap-3">
      <input className="mt-1 h-4 w-4 accent-ink" defaultChecked={preferEnglishOriginalLanguage} name="preferEnglishOriginalLanguage" type="checkbox" />
      <span>
        <span className="block text-sm font-semibold text-ink">Prefer English-original titles</span>
        <span className="mt-1 block text-sm leading-[1.5] text-muted">Gently promotes English-original movies and shows across the app. It never removes another language from results.</span>
      </span>
    </label>
    <div className="mt-5 flex items-center gap-4"><SaveButton />{state.status === "error" ? <p className="m-0 text-sm text-danger" role="alert">{state.message}</p> : null}</div>
  </form>;
}
