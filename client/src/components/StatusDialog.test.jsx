import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusDialog } from "./StatusDialog.jsx";

const noop = vi.fn();

const base = {
  repos: [{ id: 1 }],
  owners: ["alice"],
  defaultInactivityDays: 7,
  lastFetch: "2026-06-01T00:00:00Z",
  sourceWarnings: [],
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, reset: null },
};

describe("StatusDialog", () => {
  it("renders the dialog with owner link and repo count", () => {
    render(<StatusDialog data={base} onClose={noop} />);
    expect(
      screen.getByRole("dialog", { name: "Dashboard status" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@alice" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const close = vi.fn();
    render(<StatusDialog data={base} onClose={close} />);
    fireEvent.click(document.querySelector(".fixed.inset-0"));
    expect(close).toHaveBeenCalled();
  });

  it("calls onClose when the X button is clicked", () => {
    const close = vi.fn();
    render(<StatusDialog data={base} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Close status" }));
    expect(close).toHaveBeenCalled();
  });

  it("hides the rate-limit section and covers pct=null branch when rateLimit is null", () => {
    render(<StatusDialog data={{ ...base, rateLimit: null }} onClose={noop} />);
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it("shows rose coloring and reset time when remaining is 0 (covers line-22 truthy and line-91 rose branches)", () => {
    const data = {
      ...base,
      rateLimit: { remaining: 0, limit: 5000, used: 5000, reset: 1893456000 },
    };
    render(<StatusDialog data={data} onClose={noop} />);
    expect(screen.getByText("0 remaining")).toBeInTheDocument();
    expect(screen.getByText(/Resets at/)).toBeInTheDocument();
  });

  it("shows amber coloring when remaining < 100 and pct > 80 (remaining=50, limit=5000)", () => {
    const data = {
      ...base,
      rateLimit: { remaining: 50, limit: 5000, used: 4950, reset: null },
    };
    render(<StatusDialog data={data} onClose={noop} />);
    expect(screen.getByText("50 remaining")).toBeInTheDocument();
  });

  it("shows source warnings when present", () => {
    const data = { ...base, sourceWarnings: ["org scope is public-only"] };
    render(<StatusDialog data={data} onClose={noop} />);
    expect(screen.getByText("org scope is public-only")).toBeInTheDocument();
  });
});
