import { useEffect, useRef, useState } from "react";
import { tinykeys } from "tinykeys";
import { cx } from "../lib/constants.js";
import { getElementIdentifier, isEditableTarget } from "../lib/devIdOverlay.js";

const STORAGE_KEY = "repo-triage-dev-id-overlay";

// Dev-only element identifier overlay: toggled on, hovering any element shows
// a small tooltip with a selector-like identifier for it (see
// getElementIdentifier()); clicking copies it to the clipboard. Exists purely
// to give an AI assistant (or a human) a stable way to point at "that
// element" during local UI debugging — see DESIGN.md → Dev id overlay.
export function DevIdOverlay() {
  const [active, setActive] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [tooltip, setTooltip] = useState(null); // null | { x, y, text, copied }
  const containerRef = useRef(null);
  const posRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const copiedTimeoutRef = useRef(null);

  const toggle = () => {
    setActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (!next) setTooltip(null);
      return next;
    });
  };

  // Global shortcut — ignored while typing in a form field.
  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      "Control+Shift+I": (event) => {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        toggle();
      },
    });
    return unsubscribe;
  }, []);

  // Hover tracking + click-to-copy, only wired up while active.
  useEffect(() => {
    if (!active) return undefined;

    const scheduleUpdate = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const { x, y } = posRef.current;
        const el = document.elementFromPoint(x, y);
        if (!el || containerRef.current?.contains(el)) return;
        setTooltip({ x, y, text: getElementIdentifier(el), copied: false });
      });
    };

    const onMouseMove = (event) => {
      posRef.current = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    };

    const onClick = (event) => {
      // event.target, not elementFromPoint — this must reflect what was
      // actually clicked (e.g. the toggle button itself) so the overlay's
      // own controls stay clickable while active.
      const el = event.target;
      if (!el || containerRef.current?.contains(el)) return;
      event.preventDefault();
      event.stopPropagation();
      const text = getElementIdentifier(el);
      navigator.clipboard?.writeText(text).then(() => {
        setTooltip({ x: event.clientX, y: event.clientY, text, copied: true });
        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => {
          setTooltip((prev) => (prev ? { ...prev, copied: false } : prev));
        }, 1200);
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    };
  }, [active]);

  return (
    <div ref={containerRef}>
      <button
        onClick={toggle}
        aria-pressed={active}
        aria-label="Toggle element identifier overlay"
        title="Toggle element identifier overlay (Ctrl+Shift+I)"
        className={cx(
          "fixed bottom-4 right-4 z-50 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
          active
            ? "border-neutral-600 bg-neutral-800 text-neutral-200"
            : "border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-300",
        )}
      >
        [id]
      </button>
      {active && tooltip && (
        <div
          role="status"
          aria-hidden="true"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          className="pointer-events-none fixed z-50 max-w-xs truncate rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200 shadow-2xl"
        >
          {tooltip.copied ? `copied: ${tooltip.text}` : tooltip.text}
        </div>
      )}
    </div>
  );
}
