"use client";

import { useFormStatus } from "react-dom";
import { deleteRatingsAction } from "@/lib/ratings-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button
    className="min-h-11 rounded-full border border-danger/40 px-5 py-2 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-60"
    disabled={pending}
    type="submit"
  >
    {pending ? "Deleting…" : "Delete list"}
  </button>;
}

export function RatingsDeleteButton() {
  return <form
    action={deleteRatingsAction}
    onSubmit={(event) => {
      if (!window.confirm("Delete your entire imported ratings list? This can't be undone.")) event.preventDefault();
    }}
  >
    <SubmitButton />
  </form>;
}
