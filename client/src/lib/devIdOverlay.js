// Pure helpers for the dev-only element identifier overlay. Kept separate
// from the component so identifier generation is trivially unit-testable
// (see board.js/issues.js for the same pattern used elsewhere).

const COMPONENT_ATTRS = ["data-slot", "data-testid", "data-component"];

export function isDevIdOverlayEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_DEV_ID_OVERLAY === "true";
}

// Dev/local-only, purpose-built identifier attribute (see #79) — spread onto
// a component's root element via `{...devId('ComponentName')}`. Stripped from
// normal production output unless the local Docker build opts in with
// VITE_DEV_ID_OVERLAY=true.
export function devId(name) {
  return isDevIdOverlayEnabled() ? { "data-id": name } : {};
}

// Builds a short, stable-ish selector-like identifier for an element, to
// point an AI assistant (or a human) at it during local UI debugging.
// Priority: the element's own id > its dev-only `data-id` (#79) > its own
// class names > other component metadata attributes > bare tag name.
// Deliberately checks the element itself only, not ancestors — the whole app
// mounts under Vite's `<div id="root">`, so walking up to the "nearest"
// ancestor id would resolve almost every element to `#root`, which
// identifies nothing useful.
export function getElementIdentifier(el) {
  if (!el || el.nodeType !== 1) return null;

  if (el.id) return `#${el.id}`;

  const dataId = el.getAttribute?.("data-id");
  if (dataId) return `[data-id="${dataId}"]`;

  const classes =
    typeof el.className === "string"
      ? el.className.trim().split(/\s+/).filter(Boolean)
      : [];
  if (classes.length > 0) {
    return `${el.tagName.toLowerCase()}.${classes.slice(0, 2).join(".")}`;
  }

  for (const attr of COMPONENT_ATTRS) {
    const value = el.getAttribute?.(attr);
    if (value) return `[${attr}="${value}"]`;
  }

  return el.tagName.toLowerCase();
}

// Ctrl/Cmd+Shift+I should not fire while the user is typing.
export function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target.isContentEditable)
  );
}
