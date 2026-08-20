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
});
