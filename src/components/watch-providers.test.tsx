import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WatchProvidersSection } from "./watch-providers";
import type { WatchProvider, WatchProviders } from "@/types/tmdb";

function provider(name: string): WatchProvider {
  return { id: name.length, name, logoUrl: null };
}

function providers(overrides: Partial<WatchProviders> = {}): WatchProviders {
  return { link: null, flatrate: [], rent: [], buy: [], ...overrides };
}

describe("WatchProvidersSection", () => {
  // A schema having flatrate/rent/buy slots isn't a reason to render a
  // "Where to watch" card with nothing in it — this is the same
  // hide-when-empty rule applied to the Details/Release history section.
  it("renders nothing when there are no providers at all", () => {
    const { container } = render(<WatchProvidersSection watchProviders={providers()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the groups that actually have providers", () => {
    render(<WatchProvidersSection watchProviders={providers({ flatrate: [provider("Netflix")] })} />);
    expect(screen.getByText("Included with subscription")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(screen.queryByText("Buy")).not.toBeInTheDocument();
  });

  it("renders every group once each has at least one provider", () => {
    render(<WatchProvidersSection watchProviders={providers({
      flatrate: [provider("Netflix")],
      rent: [provider("Amazon Video")],
      buy: [provider("Apple TV")],
    })} />);
    expect(screen.getByText("Included with subscription")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Amazon Video")).toBeInTheDocument();
    expect(screen.getByText("Apple TV")).toBeInTheDocument();
  });
});
