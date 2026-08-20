import { beforeEach, describe, expect, it, vi } from "vitest";

const tmdb = vi.hoisted(() => ({
  findMovieByImdbId: vi.fn(),
  findTvByImdbId: vi.fn(),
  findTvParentByEpisodeImdbId: vi.fn(),
  getTvShowName: vi.fn(),
}));

vi.mock("@/lib/tmdb", () => tmdb);

import { importCsv } from "./watchlist";

const header = "Const,Title,Title Type,Created,Release Date,Your Rating";

describe("watchlist import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tmdb.findMovieByImdbId.mockResolvedValue(101);
    tmdb.findTvByImdbId.mockResolvedValue(202);
    tmdb.findTvParentByEpisodeImdbId.mockResolvedValue(303);
    tmdb.getTvShowName.mockResolvedValue("Parent Show");
  });

  it("keeps actionable screen titles and records their availability", async () => {
    const rows = await importCsv([
      header,
      "tt-movie,Released Movie,Movie,2026-01-01,2025-01-01,",
      "tt-upcoming,Future Movie,Movie,2026-01-01,2099-01-01,",
      "tt-pending,Announced Movie,Movie,2026-01-01,,",
    ].join("\n"));

    expect(rows).toMatchObject([
      { imdbId: "tt-movie", mediaType: "movie", tmdbId: 101, status: "available" },
      { imdbId: "tt-upcoming", mediaType: "movie", tmdbId: 101, status: "upcoming" },
      { imdbId: "tt-pending", mediaType: "movie", tmdbId: 101, status: "metadata_pending" },
    ]);
  });

  it("omits rated and non-screen entries, and maps an episode to its parent show", async () => {
    const rows = await importCsv([
      header,
      "tt-rated,Already Watched,Movie,2026-01-01,2025-01-01,9",
      "tt-game,Game,Video Game,2026-01-01,2026-01-01,",
      "tt-episode,Episode Name,TV Episode,2026-01-01,2026-01-01,",
    ].join("\n"));

    expect(rows).toEqual([expect.objectContaining({
      imdbId: "tt-episode",
      tmdbId: 303,
      mediaType: "tv",
      title: "Parent Show",
      resolvedFromEpisode: true,
    })]);
    expect(tmdb.findTvParentByEpisodeImdbId).toHaveBeenCalledWith("tt-episode");
    expect(tmdb.findMovieByImdbId).not.toHaveBeenCalledWith("tt-game");
  });
});
