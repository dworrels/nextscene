import { describe, expect, it } from "vitest";
import { parseSearchIntent } from "./search-intent";

describe("parseSearchIntent", () => {
  it("detects media type", () => {
    expect(parseSearchIntent("great recent tv shows").mediaType).toBe("tv");
    expect(parseSearchIntent("a good movie for tonight").mediaType).toBe("movie");
    expect(parseSearchIntent("something dark and moody").mediaType).toBeNull();
  });

  it("resolves a referenced title from a \"like X\" phrase", () => {
    expect(parseSearchIntent("something like Interstellar").referencedTitle).toBe("Interstellar");
  });

  it("cuts a referenced title at a trailing connector", () => {
    expect(parseSearchIntent("like Interstellar but simpler").referencedTitle).toBe("Interstellar");
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
    expect(parseSearchIntent("a dark mystery").watchProvider).toBeNull();
  });
});
