"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { importWatchlistAction, type ImportState } from "@/lib/watchlist-actions";

const initialState: ImportState = { status: "idle" };

function ImportTrigger({ id, className, idleLabel }: { id: string; className: string; idleLabel: string }) {
  const { pending } = useFormStatus();
  const inputRef = useRef<HTMLInputElement>(null);

  return <>
    <input
      className="sr-only"
      id={id}
      name="file"
      type="file"
      accept=".csv"
      required
      disabled={pending}
      ref={inputRef}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    />
    <button
      className={`${className} disabled:opacity-60`}
      type="button"
      disabled={pending}
      onClick={() => inputRef.current?.click()}
    >
      {pending ? "Importing…" : idleLabel}
    </button>
  </>;
}

export function WatchlistImportForm({ variant }: { variant: "empty" | "toolbar" }) {
  const [state, formAction] = useActionState(importWatchlistAction, initialState);

  if (variant === "empty") {
    return <form className="mx-auto mt-6 flex max-w-[420px] flex-col items-center gap-3" action={formAction}>
      <ImportTrigger id="watchlist-file-empty" className="min-h-11 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bg" idleLabel="Import watchlist" />
      {state.status === "error" ? <p className="text-xs text-danger" role="alert">{state.message}</p> : null}
    </form>;
  }

  return <form action={formAction}>
    <ImportTrigger id="watchlist-file-toolbar" className="min-h-11 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-bg" idleLabel="Replace list" />
    {state.status === "error" ? <p className="mt-2 text-xs text-danger" role="alert">{state.message}</p> : null}
  </form>;
}
