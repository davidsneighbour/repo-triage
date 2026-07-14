import { useEffect, useState } from "react";

// The single mobile/desktop breakpoint (see DESIGN.md → Layout → Responsive /
// mobile). One switch, no intermediate tablet tier.
export const MOBILE_QUERY = "(max-width: 640px)";

// SSR-safe `matchMedia` read: returns false (desktop) when there is no window
// or the environment lacks `matchMedia` (e.g. jsdom before the test mock runs).
function matches(query) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia(query).matches;
}

// Single source of truth for the mobile branch. Subscribes to the media query so
// the board re-renders when the viewport crosses the breakpoint (or a test
// swaps the mock). Only presentation should branch on this — never app logic.
export function useIsMobile(query = MOBILE_QUERY) {
  const [isMobile, setIsMobile] = useState(() => matches(query));

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    // Re-sync once on mount in case the query changed between render and effect.
    setIsMobile(mql.matches);
    // `addEventListener` is the modern API; `addListener` is the Safari < 14 fallback.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return isMobile;
}
