"use client";

import { useFormStatus } from "react-dom";
import { dismissFranchiseUpdateAction } from "@/lib/franchise-updates-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button
    className="min-h-9 rounded-full border border-line bg-bg/80 px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-soft disabled:opacity-60"
    disabled={pending}
    type="submit"
  >
    {pending ? "…" : "Dismiss"}
  </button>;
}

export function DismissUpdateButton({ id }: { id: string }) {
  return <form action={dismissFranchiseUpdateAction}>
    <input name="id" type="hidden" value={id} />
    <SubmitButton />
  </form>;
}
