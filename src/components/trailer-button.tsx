"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

export function TrailerButton({ videoKey }: { videoKey: string }) {
  const [open, setOpen] = useState(false);

  return <>
    <button
      className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
      onClick={() => setOpen(true)}
    >
      <Play className="h-4 w-4" aria-hidden="true" /> Watch trailer
    </button>
    {open ? (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-6" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
        <button
          className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => setOpen(false)}
          aria-label="Close trailer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="aspect-video w-full max-w-[960px]" onClick={(event) => event.stopPropagation()}>
          <iframe
            className="h-full w-full rounded-xl"
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
            title="Trailer"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    ) : null}
  </>;
}
