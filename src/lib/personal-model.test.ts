import { describe, expect, it } from "vitest";
import {
  getFeatureEvidence,
  predictPersonalRating,
  trainPersonalModel,
} from "./personal-model";
import type { MediaItem } from "@/types/tmdb";

function title(
  id: number,
  genre: string,
  originalLanguageCode: string,
  runtimeMinutes = 100,
  keywords = genre === "Comedy" ? ["friendship", "feel-good"] : ["violence", "survival"],
): MediaItem {
  return {
    id,
    mediaType: "movie",
    title: `Title ${id}`,
    overview: genre === "Comedy" ? "A warm friendship comedy." : "A violent psychological survival story.",
    releaseDate: "2024-01-01",
    year: "2024",
    posterUrl: null,
    backdropUrl: null,
    genre,
    genres: [genre],
    audienceScore: genre === "Comedy" ? 82 : 61,
    originalLanguageCode,
    runtimeMinutes,
    keywords,
  };
}

describe("personal rating model", () => {
  const training = Array.from({ length: 24 }, (_, index) => {
    const liked = index < 12;
    return {
      item: title(index + 1, liked ? "Comedy" : "Horror", liked ? "en" : "ja"),
      rating: liked ? 9 : 3,
      vector: liked ? [1, 0] : [0, 1],
    };
  });

  it("learns positive and negative personal patterns and validates on held-out ratings", () => {
    const model = trainPersonalModel(training);
    expect(model).not.toBeNull();
    if (!model) return;

    const liked = predictPersonalRating(model, title(101, "Comedy", "en"), [1, 0]);
    const disliked = predictPersonalRating(model, title(102, "Horror", "ja"), [0, 1]);

    expect(liked.estimatedRating).toBeGreaterThan(disliked.estimatedRating);
    expect(liked.estimatedRating).toBeGreaterThanOrEqual(7.5);
    expect(disliked.estimatedRating).toBeLessThanOrEqual(4.5);
    expect(model.validationCount).toBeGreaterThan(0);
    expect(model.validationMae).not.toBeNull();
  });

  it("produces auditable feature evidence", () => {
    const model = trainPersonalModel(training);
    expect(model).not.toBeNull();
    if (!model) return;

    const evidence = getFeatureEvidence(model, title(103, "Comedy", "en"));
    expect(evidence.some((entry) => entry.key === "genre:comedy" && entry.averageRating === 9)).toBe(true);
    expect(evidence.some((entry) => entry.key === "language:en" && entry.count === 12)).toBe(true);
  });

  it("uses recurring keyword signals beyond the original ten-keyword cap", () => {
    const keywords = Array.from({ length: 15 }, (_, index) => `theme ${index + 1}`);
    const model = trainPersonalModel(Array.from({ length: 12 }, (_, index) => ({
      item: title(index + 200, "Comedy", "en", 100, keywords),
      rating: 9,
    })));
    expect(model).not.toBeNull();
    if (!model) return;

    const evidence = getFeatureEvidence(model, title(300, "Comedy", "en", 100, keywords));
    expect(evidence.some((entry) => entry.key === "keyword:theme 15" && entry.count === 12)).toBe(true);
  });
});
