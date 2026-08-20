import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilmCard } from "./film-card";
import type { MediaItem } from "@/types/tmdb";

function movie(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 45269,
    mediaType: "movie",
    title: "The King's Speech",
    overview: "Overview",
    releaseDate: "2010-11-26",
    year: "2010",
    posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
    backdropUrl: null,
    genre: "Drama",
    audienceScore: 77,
    ...overrides,
  };
}

describe("FilmCard", () => {
  it("links to the movie or tv detail page based on mediaType", () => {
    const { rerender } = render(<FilmCard movie={movie()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/movies/45269");

    rerender(<FilmCard movie={movie({ mediaType: "tv", id: 100 })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tv/100");
  });

  it("renders a plain badge as a simple label", () => {
    render(<FilmCard badge="9.5/10" movie={movie()} />);
    expect(screen.getByText("9.5/10")).toBeInTheDocument();
  });

  // badge and predictedBadge are deliberately distinct props (see
  // film-card.tsx) — badge is for an actual rating/release label,
  // predictedBadge is exclusively for the personal-model prediction and
  // carries a "Predicted rating for you" tooltip so it's never confused with
  // real data. Both rendering and their separation are worth locking down.
  it("marks a predicted rating distinctly from a plain badge", () => {
    render(<FilmCard movie={movie()} predictedBadge="9.6" />);
    const badge = screen.getByTitle("Predicted rating for you");
    expect(badge).toHaveTextContent("9.6");
  });

  it("renders both a plain badge and a predicted badge together without collapsing one into the other", () => {
    render(<FilmCard badge="R" movie={movie()} predictedBadge="9.6" />);
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("9.6")).toBeInTheDocument();
  });

  it("falls back to a title placeholder tile when there is no poster", () => {
    render(<FilmCard movie={movie({ posterUrl: null })} />);
    expect(screen.getByText("The King's Speech")).toBeInTheDocument();
  });
});
