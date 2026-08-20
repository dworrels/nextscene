"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";

export function TrailerButton({ videoKey }: { videoKey: string }) {
  const [open, setOpen] = useState(false);
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

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, iframe, [href], [tabindex]:not([tabindex='-1'])");
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

  return <>
    <button
      className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
      onClick={() => setOpen(true)}
      ref={triggerRef}
    >
      <Play className="h-4 w-4" aria-hidden="true" /> Watch trailer
    </button>
    {open ? createPortal(
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]" role="dialog" aria-modal="true" aria-label="Trailer" onClick={() => setOpen(false)} ref={dialogRef}>
        <button
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => setOpen(false)}
          aria-label="Close trailer"
          ref={closeRef}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="aspect-video w-[min(100%,calc((100dvh-3rem)*16/9))] max-w-[960px]" onClick={(event) => event.stopPropagation()}>
          <iframe
            className="h-full w-full rounded-xl"
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
            title="Trailer"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>,
      document.body,
    ) : null}
  </>;
}
