// Repos are grouped by how long ago they were checked.
// Bucket 0 is "today" (needs attention now), larger bucket index means later.
// defaultInactivityDays is the due age, so only N-1 future buckets exist.
// With default=7: checked 0d/1d ago -> day-6, checked 7+d ago (or never) -> day-0.

// The board counts whole *calendar* days, with the day boundary ("when tomorrow
// becomes today") configurable via DAY_ROLLOVER_HOUR. boardDayIndex maps a
// timestamp to an integer day number for the local calendar, shifted back by the
// rollover hour so a new day only begins at e.g. 04:00 local. Differences between
// two timestamps that are an exact number of 24h periods apart are invariant to
// both the rollover hour and the local timezone, which keeps the schedule stable.
export function boardDayIndex(ms, rolloverHour = 0) {
    const shifted = ms - rolloverHour * 3600000;
    const d = new Date(shifted);
    return Math.floor((shifted - d.getTimezoneOffset() * 60000) / 86400000);
}

export function effectiveState(state, defaultInactivityDays = 7, nowMs = Date.now(), rolloverHour = 0) {
    const repoDays = Math.max(0, Number(state.inactivity_days ?? defaultInactivityDays) || 0);
    const maxFutureOffset = Math.max(0, defaultInactivityDays - 1);
    const nowDay = boardDayIndex(nowMs, rolloverHour);

    // "Checked Nd ago" reflects when the repo was ACTUALLY reviewed, which is
    // independent of priority_set_at — that anchor is back-dated to position a
    // card in a future column, so it must not drive the checked-age display.
    const checkedAgeDays = state.checked_at
        ? Math.max(0, nowDay - boardDayIndex(new Date(state.checked_at).getTime(), rolloverHour))
        : null;

    if (!state.priority_set_at) {
        return {
            column: 'day-0',
            checkedAgeDays,
            boardOffset: 0,
            dueInDays: 0,
            needsCheckToday: true,
        };
    }

    const wholeDays = Math.max(0, nowDay - boardDayIndex(new Date(state.priority_set_at).getTime(), rolloverHour));
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
