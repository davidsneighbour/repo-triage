import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setDesktopViewport, setMobileViewport } from "../test/viewport.js";
import { useIsMobile } from "./useIsMobile.js";

function Probe() {
  const isMobile = useIsMobile();
  return <span data-testid="probe">{isMobile ? "mobile" : "desktop"}</span>;
}

describe("useIsMobile", () => {
  it("reports desktop by default", () => {
    setDesktopViewport();
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("desktop");
  });

  it("reports mobile when the breakpoint matches", () => {
    setMobileViewport();
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("mobile");
  });

  it("falls back to desktop when matchMedia is unavailable", () => {
    const original = window.matchMedia;
    // Simulate an environment without matchMedia (SSR / very old jsdom).
    delete window.matchMedia;
    act(() => {
      render(<Probe />);
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("desktop");
    window.matchMedia = original;
  });
});
