import { describe, expect, it } from "vitest";
import { filterReleaseTimeline, formatFullDate, formatRuntime } from "./format";

describe("formatFullDate", () => {
  it("formats a plain YYYY-MM-DD date", () => {
    expect(formatFullDate("2010-11-26")).toBe("Nov 26, 2010");
  });

  it("returns null for an empty date", () => {
    expect(formatFullDate("")).toBeNull();
  });

  // TMDb's /release_dates endpoint returns a full ISO timestamp
  // ("2010-11-26T00:00:00.000Z") rather than the plain "YYYY-MM-DD" used
  // elsewhere — appending a time suffix onto that (as this function does for
  // the plain-date case) previously produced an unparseable string and
  // silently fell back to "TBA" for every release-history entry.
  it("returns null rather than a garbled date for a full ISO timestamp", () => {
    expect(formatFullDate("2010-11-26T00:00:00.000Z")).toBeNull();
  });
});

describe("formatRuntime", () => {
  it("formats hours and minutes", () => {
    expect(formatRuntime(115)).toBe("1h 55m");
  });

  it("omits minutes when the runtime is an exact number of hours", () => {
    expect(formatRuntime(120)).toBe("2h");
  });

  it("omits hours for anything under 60 minutes", () => {
    expect(formatRuntime(45)).toBe("45m");
  });
});

describe("filterReleaseTimeline", () => {
  it("drops entries whose date can't be resolved instead of showing a placeholder", () => {
    const result = filterReleaseTimeline([
      { type: "Premiere", date: "2010-09-06" },
      { type: "Theatrical", date: "" },
    ]);
    expect(result).toEqual([{ type: "Premiere", date: "Sep 6, 2010" }]);
  });

  it("returns an empty array when nothing resolves, so the section can be hidden", () => {
    expect(filterReleaseTimeline([{ type: "Premiere", date: "" }])).toEqual([]);
  });
});
