"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { rateMediaAction } from "@/lib/ratings-actions";
import type { MediaType } from "@/types/tmdb";

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Plain 1-10 buttons, matching IMDb's own rating scale exactly so a rating
// set here and one imported from an IMDb export mean the same thing.
export function RatingControl({
  mediaType,
  tmdbId,
  title,
  rating,
}: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  rating: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
      trigger?.focus();
    };
  }, [open]);

  function submit(value: number | null) {
    const formData = new FormData();
    formData.set("mediaType", mediaType);
    formData.set("tmdbId", String(tmdbId));
    formData.set("title", title);
    if (value !== null) formData.set("rating", String(value));
    startTransition(() => rateMediaAction(formData));
    setOpen(false);
  }

  return <>
    <button
      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 max-[760px]:px-3 max-[760px]:text-xs max-[760px]:whitespace-normal"
      onClick={() => setOpen(true)}
      ref={triggerRef}
    >
      {rating !== null ? `Your rating: ${rating}/10` : "Rate"}
    </button>
    {open ? createPortal(
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Rate ${title}`} onClick={() => setOpen(false)} ref={dialogRef}>
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-soft p-6 max-[480px]:p-5" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-ink">Rate</h2>
              <p className="m-0 mt-0.5 break-words text-sm text-muted">{title}</p>
            </div>
            <button aria-label="Close" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-well text-ink hover:bg-line" onClick={() => setOpen(false)} ref={closeRef}>
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          {/* grid-cols-10 (not fixed-width buttons) so the row scales down to
              fit narrow phones instead of overflowing the card. */}
          <div className="mt-5 grid grid-cols-10 gap-1 rounded-full border border-line bg-well p-1.5" role="group" aria-label="Your rating">
            {SCALE.map((value) => {
              const active = rating === value;
              return <button
                aria-label={`Rate ${value} out of 10`}
                aria-pressed={active}
                className={`grid aspect-square w-full min-w-0 place-items-center rounded-full text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                  active ? "bg-ink text-bg" : "text-muted hover:bg-line hover:text-ink"
                }`}
                disabled={isPending}
                key={value}
                onClick={() => submit(active ? null : value)}
                type="button"
              >
                {value}
              </button>;
            })}
          </div>
        </div>
      </div>,
      document.body,
    ) : null}
  </>;
}
