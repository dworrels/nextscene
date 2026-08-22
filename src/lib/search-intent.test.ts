import { describe, expect, it } from "vitest";
import { parseSearchIntent } from "./search-intent";

describe("parseSearchIntent", () => {
  it("detects media type", () => {
    expect(parseSearchIntent("great recent tv shows").mediaType).toBe("tv");
    expect(parseSearchIntent("a good movie for tonight").mediaType).toBe("movie");
    expect(parseSearchIntent("something dark and moody").mediaType).toBeNull();
  });

  it("resolves a referenced title from a \"like X\" phrase", () => {
    expect(parseSearchIntent("something like Interstellar").referencedTitles).toEqual(["Interstellar"]);
  });

  it("cuts a referenced title at a trailing connector", () => {
    expect(parseSearchIntent("like Interstellar but simpler").referencedTitles).toEqual(["Interstellar"]);
  });

  it("supports two title references", () => {
    expect(parseSearchIntent("more like Arrival and Interstellar").referencedTitles).toEqual(["Arrival", "Interstellar"]);
  });

  it("parses an hour-based runtime constraint", () => {
    expect(parseSearchIntent("something under 2 hours").runtimeUnderMinutes).toBe(120);
  });

  it("parses a minute-based runtime constraint", () => {
    expect(parseSearchIntent("under 90 minutes").runtimeUnderMinutes).toBe(90);
  });

  it("leaves the runtime constraint null when none is mentioned", () => {
    expect(parseSearchIntent("a dark mystery").runtimeUnderMinutes).toBeNull();
  });

  it("detects an excluded genre from negated phrasing", () => {
    expect(parseSearchIntent("something fun, no horror").excludedGenres.map((genre) => genre.label)).toEqual(["Horror"]);
    expect(parseSearchIntent("a good movie, not a documentary").excludedGenres.map((genre) => genre.label)).toEqual(["Documentary"]);
    expect(parseSearchIntent("a comedy").excludedGenres).toEqual([]);
  });

  it("matches an excluded genre's TMDb name, not just the trigger word", () => {
    const [excluded] = parseSearchIntent("no sci-fi").excludedGenres;
    expect(excluded.matcher.test("Science Fiction")).toBe(true);
    expect(excluded.matcher.test("Comedy")).toBe(false);
  });

  it("detects a mentioned streaming service", () => {
    expect(parseSearchIntent("something on netflix").watchProvider).toEqual({ id: 8, name: "Netflix" });
    expect(parseSearchIntent("great shows on Hulu").watchProvider).toEqual({ id: 15, name: "Hulu" });
    expect(parseSearchIntent("a movie included with Netflix").watchProvider).toEqual({ id: 8, name: "Netflix" });
    expect(parseSearchIntent("anime on Crunchyroll").watchProvider).toEqual({ id: 283, name: "Crunchyroll" });
    expect(parseSearchIntent("a dark mystery").watchProvider).toBeNull();
  });

  it("parses positive genres, format, era, language, and country", () => {
    const intent = parseSearchIntent("a Japanese sci-fi film from the 1990s");
    expect(intent.mediaType).toBe("movie");
    expect(intent.includedGenres.map((genre) => genre.label)).toEqual(["Sci-Fi"]);
    expect(intent.dateRange).toEqual({ start: "1990-01-01", end: "1999-12-31", label: "1990s" });
    expect(intent.originalLanguage).toMatchObject({ code: "ja" });
    expect(intent.originCountry).toMatchObject({ code: "JP" });
  });

  it("parses family, intensity, and TV-shape constraints", () => {
    const intent = parseSearchIntent("a family-friendly limited series, not too intense, under 10 episodes, finished");
    expect(intent.familyFriendly).toBe(true);
    expect(intent.lowIntensity).toBe(true);
    expect(intent.excludedGenres.map((genre) => genre.label)).toEqual(["Horror", "Thriller"]);
    expect(intent.tvType).toBe("miniseries");
    expect(intent.maxEpisodes).toBe(10);
    expect(intent.tvStatus).toMatchObject({ value: "3" });
  });

  it("parses actor and director names", () => {
    expect(parseSearchIntent("a thriller directed by Christopher Nolan").person).toEqual({ name: "Christopher Nolan", role: "director" });
    expect(parseSearchIntent("a movie with Tom Hanks").person).toEqual({ name: "Tom Hanks", role: "actor" });
  });
});
