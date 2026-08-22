import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cosineSimilarity: vi.fn(() => 0.5),
  getFilteredCandidateItems: vi.fn(),
  getMediaCards: vi.fn(),
  getPersonalModel: vi.fn(),
  getPersonalTasteVector: vi.fn(),
  getPersonallyRankedCandidates: vi.fn(),
  getRecentCandidateItems: vi.fn(),
  getReferencedTitleRecommendations: vi.fn(),
  getSearchCandidatePool: vi.fn(),
  resolveReferencedTitle: vi.fn(),
}));

vi.mock("@/lib/embeddings", () => ({
  cosineSimilarity: mocks.cosineSimilarity,
  embedMediaItems: vi.fn(async (items: Array<{ id: number; mediaType: string }>) => new Map(items.map((item) => [`${item.mediaType}-${item.id}`, [1]]))),
  embedQuery: vi.fn(async () => [1]),
}));
vi.mock("@/lib/content-preferences", () => ({
  languagePreferenceBoost: vi.fn(() => 0),
  readContentPreferences: vi.fn(async () => ({ preferEnglishOriginalLanguage: false })),
}));
vi.mock("@/lib/personal-model", () => ({ predictPersonalRating: vi.fn() }));
vi.mock("@/lib/recommendation-selection", () => ({ HIGH_MATCH_THRESHOLD: 75 }));
vi.mock("@/lib/recommendations", () => ({
  getFilteredCandidateItems: mocks.getFilteredCandidateItems,
  getMediaCards: mocks.getMediaCards,
  getPersonalModel: mocks.getPersonalModel,
  getPersonalTasteVector: mocks.getPersonalTasteVector,
  getPersonallyRankedCandidates: mocks.getPersonallyRankedCandidates,
  getRecentCandidateItems: mocks.getRecentCandidateItems,
  getReferencedTitleRecommendations: mocks.getReferencedTitleRecommendations,
  getSearchCandidatePool: mocks.getSearchCandidatePool,
  resolveReferencedTitle: mocks.resolveReferencedTitle,
}));
vi.mock("@/lib/tmdb", () => ({ getMediaCards: mocks.getMediaCards }));

import { semanticSearchAction } from "./semantic-search-actions";

const movie = (id: number, title = `Movie ${id}`) => ({
  id,
  mediaType: "movie" as const,
  title,
  overview: "A matching title.",
  releaseDate: "1995-01-01",
  year: "1995",
  posterUrl: null,
  backdropUrl: null,
  genre: "Science Fiction",
  genres: ["Science Fiction"],
  audienceScore: 80,
  originalLanguageCode: "ja",
  originCountryCodes: ["JP"],
});

describe("semanticSearchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPersonalModel.mockResolvedValue(null);
    mocks.getPersonalTasteVector.mockResolvedValue(null);
    mocks.getPersonallyRankedCandidates.mockResolvedValue([]);
    mocks.getRecentCandidateItems.mockResolvedValue([]);
    mocks.getReferencedTitleRecommendations.mockResolvedValue([]);
    mocks.getSearchCandidatePool.mockResolvedValue([]);
    mocks.resolveReferencedTitle.mockResolvedValue(null);
    mocks.getFilteredCandidateItems.mockResolvedValue([]);
    mocks.getMediaCards.mockResolvedValue(new Map());
    mocks.cosineSimilarity.mockReturnValue(0.5);
  });

  it("keeps valid hard-filter results even when their semantic score is weak", async () => {
    mocks.getFilteredCandidateItems.mockResolvedValue([movie(1)]);
    mocks.cosineSimilarity.mockReturnValue(0.1);
    const formData = new FormData();
    formData.set("query", "a Japanese sci-fi film from the 1990s");

    const result = await semanticSearchAction({ status: "idle", results: [] }, formData);

    expect(result.weakMatch).toBeFalsy();
    expect(result.noResults).toBeFalsy();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].item.title).toBe("Movie 1");
  });

  it("merges positive-genre discovery candidates into the broad semantic pool", async () => {
    mocks.getSearchCandidatePool.mockResolvedValue([movie(1, "Broad candidate")]);
    mocks.getFilteredCandidateItems.mockResolvedValue([movie(2, "Genre expansion")]);
    const formData = new FormData();
    formData.set("query", "a dark mystery");

    const result = await semanticSearchAction({ status: "idle", results: [] }, formData);

    expect(mocks.getSearchCandidatePool).toHaveBeenCalledWith("a dark mystery");
    expect(result.results.map((entry) => entry.item.title)).toEqual(["Broad candidate", "Genre expansion"]);
  });
});
