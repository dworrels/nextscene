import { describe, expect, it } from "vitest";
import { diversifyVibeResults, extractVibeGenres, type SemanticSearchResult } from "./vibe-search";

function result(id: number, genre: string, similarity: number): SemanticSearchResult {
  return {
    similarity,
    predictedRating: null,
    predictedConfidence: null,
    item: { id, mediaType: "movie", title: `Title ${id}`, overview: "", releaseDate: "", year: "2026", posterUrl: null, backdropUrl: null, genre, audienceScore: 70 },
  };
}

describe("vibe search helpers", () => {
  it("derives relevant TMDb genre filters from a descriptive query", () => {
    const genres = extractVibeGenres("a dark mystery with an unreliable narrator");
    expect(genres.map((genre) => genre.movieGenreId)).toEqual([9648, 27]);
  });

  it("keeps the initial results varied before continuing in semantic rank order", () => {
    const results = [
      result(1, "Horror", 0.9), result(2, "Horror", 0.89), result(3, "Horror", 0.88),
      result(4, "Mystery", 0.87), result(5, "Thriller", 0.86), result(6, "Drama", 0.85),
      result(7, "Comedy", 0.84), result(8, "Science Fiction", 0.83),
    ];
    const diversified = diversifyVibeResults(results, 8, 6, 2);
    expect(diversified.slice(0, 6).filter((entry) => entry.item.genre === "Horror")).toHaveLength(2);
    expect(diversified.map((entry) => entry.item.id)).toEqual([1, 2, 4, 5, 6, 7, 3, 8]);
  });
});
