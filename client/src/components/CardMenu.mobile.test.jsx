import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDesktopViewport, setMobileViewport } from "../test/viewport.js";
import { CardMenu } from "./CardMenu.jsx";

const repo = {
  id: 1,
  name: "widget",
  tags: ["infra"],
  priority: null,
  notice_count: 0,
};

const noop = () => {
  /* no-op */
};
const handlers = {
  onSetChecked: noop,
  onClearCheck: noop,
  onSetPriority: noop,
  onSetInactivity: noop,
  onSetIgnored: noop,
  onAddNotice: noop,
  onViewNotices: noop,
  onAddTag: noop,
  onRemoveTag: noop,
  onClose: noop,
  defaultInactivity: 7,
};

describe("CardMenu bottom-sheet variant (mobile)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes the same action groups as desktop", () => {
    setMobileViewport();
    render(
      <CardMenu repo={repo} anchorRef={{ current: null }} {...handlers} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Settings for widget" });
    expect(dialog).toBeInTheDocument();
    // Timing, priority, interval, tags, ignore, notices — all reachable.
    expect(
      screen.getByRole("button", { name: "Checked now" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move to Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear check date" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Set triage priority" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByLabelText("New tag")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ignore repo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New notice")).toBeInTheDocument();
  });

  it("renders as a bottom sheet (pinned to the viewport bottom edge)", () => {
    setMobileViewport();
    render(
      <CardMenu repo={repo} anchorRef={{ current: null }} {...handlers} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Settings for widget" });
    expect(dialog.className).toMatch(/bottom-0/);
    expect(dialog.className).toMatch(/inset-x-0/);
  });

  it("keeps the anchored popover layout on desktop", () => {
    setDesktopViewport();
    // Desktop positions against the trigger; give it a real anchor element so
    // the popover resolves a position instead of staying visibility:hidden.
    const anchor = document.createElement("button");
    render(
      <CardMenu repo={repo} anchorRef={{ current: anchor }} {...handlers} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Settings for widget" });
    expect(dialog.className).toMatch(/w-64/);
    expect(dialog.className).not.toMatch(/bottom-0/);
  });
});
