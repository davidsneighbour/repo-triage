// jsdom has no `matchMedia`, so `useIsMobile` can't read the viewport in tests.
// This helper installs a `window.matchMedia` mock and lets a test force the
// mobile or desktop branch. `resetViewport` (called from setup's afterEach)
// restores the desktop default so a mobile test can't leak across tests.

function install(isMobile) {
  const listeners = new Set();
  const mql = {
    get matches() {
      return isMobile;
    },
    media: "",
    onchange: null,
    addEventListener(_type, cb) {
      listeners.add(cb);
    },
    removeEventListener(_type, cb) {
      listeners.delete(cb);
    },
    // Safari < 14 fallback API.
    addListener(cb) {
      listeners.add(cb);
    },
    removeListener(cb) {
      listeners.delete(cb);
    },
    dispatchEvent() {
      return false;
    },
  };
  window.matchMedia = (query) => ({ ...mql, media: query });
}

// Force the mobile branch (matchMedia(...).matches === true).
export function setMobileViewport() {
  install(true);
}

// Force the desktop branch (the default).
export function setDesktopViewport() {
  install(false);
}

// Restore the desktop default. Called from the global afterEach.
export function resetViewport() {
  install(false);
}

// Install the default once on import so the very first render has matchMedia.
install(false);
