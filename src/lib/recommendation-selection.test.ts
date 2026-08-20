import { describe, expect, it } from "vitest";
import { buildProfileRails, type RankedMediaItem } from "./recommendation-selection";
import type { ConfidenceLevel } from "./personal-model";

function candidate(id: number, genre: string, source: "personal" | "discovery", personalSimilarity = id / 100, matchScore = 70, confidence: ConfidenceLevel = "high"): RankedMediaItem {
  return {
    source,
    personalSimilarity,
    matchScore,
    confidence,
    item: {
      id,
      mediaType: "movie",
      title: `Title ${id}`,
      overview: "Overview",
      releaseDate: "2026-01-01",
      year: "2026",
      posterUrl: null,
      backdropUrl: null,
      genre,
      audienceScore: 80,
    },
  };
}

describe("buildProfileRails", () => {
  it("keeps Tonight's best bets varied and never repeats a title between shelves", () => {
    const ranked = [
      candidate(1, "Drama", "personal"), candidate(2, "Drama", "personal"), candidate(3, "Drama", "personal"),
      candidate(4, "Comedy", "personal"), candidate(5, "Thriller", "discovery"), candidate(6, "Mystery", "discovery"),
      candidate(7, "Science Fiction", "discovery"), candidate(8, "Adventure", "discovery"),
    ];
    const rails = buildProfileRails(ranked, [candidate(9, "Drama", "discovery")], [candidate(10, "Drama", "discovery")], 4);
    const tonight = rails.find((rail) => rail.title === "Tonight's best bets")?.items ?? [];
    const allIds = rails.flatMap((rail) => rail.items.map((item) => item.id));

    expect(tonight.filter((item) => item.genre === "Drama")).toHaveLength(2);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("uses a compatible middle/lower discovery band for the stretch shelf", () => {
    const discovery = [
      candidate(1, "Drama", "discovery", 0.9), candidate(2, "Comedy", "discovery", 0.8), candidate(3, "Thriller", "discovery", 0.7),
      candidate(4, "Mystery", "discovery", 0.6), candidate(5, "Adventure", "discovery", 0.5), candidate(6, "Fantasy", "discovery", 0.4),
    ];
    const rails = buildProfileRails(discovery, [], [], 2);
    const stretch = rails.find((rail) => rail.title === "Try something a little different")?.items ?? [];

    expect(stretch.map((item) => item.id)).toEqual([3, 4]);
  });

  it("adds a non-repeating high-match shelf with top-left badge labels", () => {
    const ranked = [
      candidate(1, "Drama", "personal", 0.92, 92),
      candidate(2, "Comedy", "personal", 0.87, 87),
      candidate(3, "Thriller", "personal", 0.74, 74),
      candidate(4, "Mystery", "discovery", 0.7, 70),
    ];
    const rails = buildProfileRails(ranked, [], [], 4);
    const highMatches = rails.find((rail) => rail.title === "Top picks for you");
    const allIds = rails.flatMap((rail) => rail.items.map((item) => item.id));

    expect(highMatches?.items.map((item) => item.id)).toEqual([1, 2]);
    expect(highMatches?.predictedBadges).toEqual({ "movie-1": "9.2", "movie-2": "8.7" });
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("hides the prediction badge when confidence is low", () => {
    const rails = buildProfileRails([candidate(1, "Drama", "personal", 0.92, 92, "low")], [], [], 4);
    const highMatches = rails.find((rail) => rail.title === "Top picks for you");
    expect(highMatches?.predictedBadges).toEqual({});
  });
});
