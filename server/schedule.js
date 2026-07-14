/**
 * @module schedule
 * @description Day-schedule placement logic. Maps a repo's triage state to a
 *   board column (`day-0` = Today, `day-1..N-1` = future weekday columns).
 *   Repos are grouped by how long ago they were checked; bucket 0 is "today"
 *   (needs attention now), larger indices mean later. With `defaultInactivityDays=7`:
 *   checked 0–1 d ago → `day-6`, checked ≥7 d ago (or never) → `day-0`.
 */

/**
 * Maps a Unix timestamp to an integer "board day" number for the local
 * calendar, shifted back by `rolloverHour` so a new day only begins at that
 * hour (default 00:00). Differences between two timestamps that are exact
 * multiples of 24 h are invariant to both the rollover hour and timezone.
 *
 * @param {number} ms - Unix timestamp in milliseconds.
 * @param {number} [rolloverHour=0] - Hour (0–23, local time) at which the board advances to the next day.
 * @returns {number} Integer day index — larger values are later days.
 */
export function boardDayIndex(ms, rolloverHour = 0) {
  const shifted = ms - rolloverHour * 3600000;
  const d = new Date(shifted);
  return Math.floor((shifted - d.getTimezoneOffset() * 60000) / 86400000);
}

/**
 * Computes board placement for a single repo at read time.
 *
 * Placement rules (in priority order):
 * - Active `snooze_until` (not yet elapsed) → placed at the snooze target day, clamped to the board window.
 * - No `priority_set_at` → `day-0` (Today / inbox).
 * - Age since `priority_set_at` ≥ inactivity threshold → `day-0`.
 * - Otherwise → future bucket `day-k` where k = remaining days.
 *
 * @param {object} state - Triage row from `repo_state` (or a partial default).
 * @param {string|null} state.priority_set_at - ISO timestamp used as the scheduling anchor.
 * @param {string|null} state.checked_at - ISO timestamp of the last actual review.
 * @param {string|null} state.snooze_until - ISO timestamp of a one-off snooze; takes precedence while in the future.
 * @param {number|null} state.inactivity_days - Per-repo review interval override; `null` uses the global default.
 * @param {number} [defaultInactivityDays=7] - Global review interval in days.
 * @param {number} [nowMs=Date.now()] - Current time as a Unix timestamp (ms); override in tests.
 * @param {number} [rolloverHour=0] - Hour (0–23) at which the board rolls over to a new day.
 * @returns {{ column: string, checkedAgeDays: number|null, boardOffset: number, dueInDays: number, needsCheckToday: boolean }}
 */
export function effectiveState(
  state,
  defaultInactivityDays = 7,
  nowMs = Date.now(),
  rolloverHour = 0,
) {
  const repoDays = Math.max(
    0,
    Number(state.inactivity_days ?? defaultInactivityDays) || 0,
  );
  const maxFutureOffset = Math.max(0, defaultInactivityDays - 1);
  const nowDay = boardDayIndex(nowMs, rolloverHour);

  // "Checked Nd ago" reflects when the repo was ACTUALLY reviewed, which is
  // independent of priority_set_at — that anchor is back-dated to position a
  // card in a future column, so it must not drive the checked-age display.
  const checkedAgeDays = state.checked_at
    ? Math.max(
        0,
        nowDay -
          boardDayIndex(new Date(state.checked_at).getTime(), rolloverHour),
      )
    : null;

  // An active snooze overrides the normal interval math. Once the snooze date
  // elapses (daysUntilSnooze <= 0) it falls through to regular scheduling.
  if (state.snooze_until) {
    const snoozeDay = boardDayIndex(
      new Date(state.snooze_until).getTime(),
      rolloverHour,
    );
    const daysUntilSnooze = snoozeDay - nowDay;
    if (daysUntilSnooze > 0) {
      const boardOffset = Math.min(maxFutureOffset, daysUntilSnooze);
      return {
        column: `day-${boardOffset}`,
        checkedAgeDays,
        boardOffset,
        dueInDays: daysUntilSnooze,
        needsCheckToday: false,
      };
    }
  }

  if (!state.priority_set_at) {
    return {
      column: "unchecked",
      checkedAgeDays,
      boardOffset: 0,
      dueInDays: 0,
      needsCheckToday: true,
    };
  }

  const wholeDays = Math.max(
    0,
    nowDay -
      boardDayIndex(new Date(state.priority_set_at).getTime(), rolloverHour),
  );
  const rawOffset = repoDays - wholeDays;
  const boardOffset = Math.max(0, Math.min(maxFutureOffset, rawOffset));

  return {
    column: `day-${boardOffset}`,
    checkedAgeDays,
    boardOffset,
    dueInDays: Math.max(0, rawOffset),
    needsCheckToday: rawOffset <= 0,
  };
}
