import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveImdbTitle and getTvShowName are the only tmdb.ts functions
// watchlist.ts calls, so those are the mock boundary — mocking the lower-level
// find* functions doesn't work here since resolveImdbTitle calls them from
// within the same module, bypassing any mock of tmdb.ts's exports. The
// title-type classifiers stay real (plain, side-effect-free) via the spread.
const tmdb = vi.hoisted(() => ({
  resolveImdbTitle: vi.fn(),
  getTvShowName: vi.fn(),
}));

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tmdb")>();
  return { ...actual, ...tmdb };
});

import { importCsv } from "./watchlist";

const header = "Const,Title,Title Type,Created,Release Date,Your Rating";

describe("watchlist import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tmdb.resolveImdbTitle.mockResolvedValue({ tmdbId: 101, mediaType: "movie" });
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
    tmdb.resolveImdbTitle.mockResolvedValue({ tmdbId: 303, mediaType: "tv" });
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
    expect(tmdb.resolveImdbTitle).toHaveBeenCalledWith("tt-episode", true, true);
    expect(tmdb.resolveImdbTitle).not.toHaveBeenCalledWith("tt-game", expect.anything(), expect.anything());
  });

  it("takes whatever media type resolveImdbTitle actually matched, even against the source Title Type", async () => {
    // e.g. a "TV Special" that TMDb catalogs as a movie — resolveImdbTitle's
    // own dual-catalog fallback (verified separately) is what finds this;
    // this test only checks that watchlist.ts trusts the result it gets back.
    tmdb.resolveImdbTitle.mockResolvedValue({ tmdbId: 101, mediaType: "movie" });
    const rows = await importCsv([
      header,
      "tt-special,Stand-up Special,TV Special,2026-01-01,2026-01-01,",
    ].join("\n"));

    expect(rows).toEqual([expect.objectContaining({ imdbId: "tt-special", tmdbId: 101, mediaType: "movie" })]);
    expect(tmdb.resolveImdbTitle).toHaveBeenCalledWith("tt-special", false, true);
  });
});
