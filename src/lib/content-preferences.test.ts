import { describe, expect, it } from "vitest";
import { prioritizeMediaItems } from "./content-preferences";
import type { MediaItem } from "@/types/tmdb";

function title(id: number, originalLanguageCode: string): MediaItem {
  return {
    id,
    mediaType: "movie",
    title: `Title ${id}`,
    overview: "",
    releaseDate: "",
    year: "",
    posterUrl: null,
    backdropUrl: null,
    genre: "Drama",
    audienceScore: 0,
    originalLanguageCode,
  };
}

describe("prioritizeMediaItems", () => {
  const preferences = { preferEnglishOriginalLanguage: true };

  it("softly promotes English-original titles without dropping any candidates", () => {
    const source = [
      title(1, "ko"),
      title(2, "fr"),
      title(3, "en"),
      title(4, "ja"),
      title(5, "es"),
      title(6, "de"),
    ];

    const prioritized = prioritizeMediaItems(source, preferences);

    expect(prioritized.map((item) => item.id).sort()).toEqual(source.map((item) => item.id).sort());
    expect(prioritized.findIndex((item) => item.id === 3)).toBeLessThan(source.findIndex((item) => item.id === 3));
  });

  it("preserves the provider ordering when the preference is disabled", () => {
    const source = [title(1, "ko"), title(2, "en"), title(3, "fr")];
    expect(prioritizeMediaItems(source, { preferEnglishOriginalLanguage: false })).toEqual(source);
  });
});
