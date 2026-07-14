// localStorage-backed cache of the last good board payload, so a reload shows
// the board instantly while a fresh fetch runs in the background.
export const BOARD_CACHE_KEY = "repo-triage-board-cache-v1";

export const EMPTY_DATA = {
  repos: [],
  cacheReady: false,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: null,
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  authSource: null,
  lastError: null,
  rateLimit: null,
};

export function readBoardCache() {
  try {
    const raw = localStorage.getItem(BOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.payload ||
      !Array.isArray(parsed.payload.repos)
    ) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function writeBoardCache(payload) {
  localStorage.setItem(
    BOARD_CACHE_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      payload,
    }),
  );
}
