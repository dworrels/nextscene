"use client";

import { useFormStatus } from "react-dom";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/lib/favorites-actions";
import type { MediaType } from "@/types/tmdb";

function SubmitButton({ isFavorite }: { isFavorite: boolean }) {
  const { pending } = useFormStatus();
  const label = isFavorite ? "Remove from favorites" : "Add to favorites";

  return <button
    aria-label={label}
    aria-pressed={isFavorite}
    className={`grid min-h-[46px] min-w-[46px] place-items-center rounded-full border backdrop-blur-sm disabled:opacity-60 ${
      isFavorite ? "border-white/30 bg-white text-[#151513] hover:bg-white/90" : "border-white/30 bg-white/10 text-white hover:bg-white/20"
    }`}
    disabled={pending}
    title={label}
    type="submit"
  >
    <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}

export function FavoriteButton({ mediaType, tmdbId, title, isFavorite }: { mediaType: MediaType; tmdbId: number; title: string; isFavorite: boolean }) {
  return <form action={toggleFavoriteAction}>
    <input name="mediaType" type="hidden" value={mediaType} />
    <input name="tmdbId" type="hidden" value={tmdbId} />
    <input name="title" type="hidden" value={title} />
    <SubmitButton isFavorite={isFavorite} />
  </form>;
}
