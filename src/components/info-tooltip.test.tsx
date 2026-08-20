import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTooltip } from "./info-tooltip";

describe("InfoTooltip", () => {
  it("opens on click and closes when clicked again", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label="About this score">Explanation text</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: "About this score" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when clicking outside the tooltip", async () => {
    const user = userEvent.setup();
    render(<div><InfoTooltip label="About this score">Explanation text</InfoTooltip><button type="button">Elsewhere</button></div>);
    const trigger = screen.getByRole("button", { name: "About this score" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label="About this score">Explanation text</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: "About this score" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
