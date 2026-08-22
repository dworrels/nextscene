"use client";

import { useFormStatus } from "react-dom";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleWatchlistAction } from "@/lib/watchlist-actions";
import type { MediaType } from "@/types/tmdb";

function SubmitButton({ inWatchlist }: { inWatchlist: boolean }) {
  const { pending } = useFormStatus();
  const label = pending
    ? (inWatchlist ? "Removing…" : "Adding…")
    : (inWatchlist ? "In watchlist" : "Add to watchlist");

  return <button
    aria-pressed={inWatchlist}
    className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold backdrop-blur-sm disabled:opacity-60 max-[760px]:px-3 max-[760px]:text-xs max-[760px]:whitespace-normal ${
      inWatchlist ? "border-white/30 bg-white text-[#151513] hover:bg-white/90" : "border-white/30 bg-white/10 text-white hover:bg-white/20"
    }`}
    disabled={pending}
    type="submit"
  >
    {inWatchlist ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
    {label}
  </button>;
}

export function WatchlistButton({
  mediaType,
  tmdbId,
  title,
  imdbId,
  releaseDate,
  inWatchlist,
}: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  imdbId: string | null;
  releaseDate: string | null;
  inWatchlist: boolean;
}) {
  return <form action={toggleWatchlistAction}>
    <input name="mediaType" type="hidden" value={mediaType} />
    <input name="tmdbId" type="hidden" value={tmdbId} />
    <input name="title" type="hidden" value={title} />
    <input name="imdbId" type="hidden" value={imdbId ?? ""} />
    <input name="releaseDate" type="hidden" value={releaseDate ?? ""} />
    <SubmitButton inWatchlist={inWatchlist} />
  </form>;
}
