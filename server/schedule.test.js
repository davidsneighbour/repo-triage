import { describe, expect, it } from 'vitest';
import { boardDayIndex, effectiveState } from './schedule.js';

describe('effectiveState', () => {
    const nowMs = Date.UTC(2026, 0, 10, 12, 0, 0);

    it('returns day-0 for never checked repos', () => {
        const state = effectiveState({ priority_set_at: null, inactivity_days: null }, 7, nowMs);
        expect(state.column).toBe('day-0');
        expect(state.checkedAgeDays).toBeNull();
        expect(state.needsCheckToday).toBe(true);
    });

    it('returns future column for recent checks', () => {
        const checkedAt = new Date(nowMs - 2 * 86400000).toISOString();
        const state = effectiveState({ priority_set_at: checkedAt, inactivity_days: 7 }, 7, nowMs);
        expect(state.column).toBe('day-5');
        expect(state.dueInDays).toBe(5);
        expect(state.needsCheckToday).toBe(false);
    });

    it('returns day-0 when checked age is due or overdue', () => {
        const checkedAt = new Date(nowMs - 8 * 86400000).toISOString();
        const state = effectiveState({ priority_set_at: checkedAt, inactivity_days: 7 }, 7, nowMs);
        expect(state.column).toBe('day-0');
        expect(state.needsCheckToday).toBe(true);
    });

    it('clamps board offset to visible column count', () => {
        const checkedAt = new Date(nowMs).toISOString();
        const state = effectiveState({ priority_set_at: checkedAt, inactivity_days: 14 }, 7, nowMs);
        expect(state.column).toBe('day-6');
        expect(state.dueInDays).toBe(14);
    });

    it('derives checkedAgeDays from checked_at, independent of the back-dated anchor', () => {
        // Back-dated 6 days to land in a future column, but reviewed right now.
        const anchor = new Date(nowMs - 6 * 86400000).toISOString();
        const checked = new Date(nowMs).toISOString();
        const state = effectiveState({ priority_set_at: anchor, checked_at: checked, inactivity_days: 7 }, 7, nowMs);
        expect(state.column).toBe('day-1');
        expect(state.checkedAgeDays).toBe(0);
    });

    it('reports checkedAgeDays null when scheduled but never actually checked', () => {
        const anchor = new Date(nowMs - 7 * 86400000).toISOString();
        const state = effectiveState({ priority_set_at: anchor, checked_at: null, inactivity_days: 7 }, 7, nowMs);
        expect(state.column).toBe('day-0');
        expect(state.checkedAgeDays).toBeNull();
    });

    it('supports inactivity values 0, 1, 7, 14 and null', () => {
        const checkedAt = new Date(nowMs).toISOString();

        const zeroDays = effectiveState({ priority_set_at: checkedAt, inactivity_days: 0 }, 7, nowMs);
        expect(zeroDays.column).toBe('day-0');
        expect(zeroDays.needsCheckToday).toBe(true);

        const oneDay = effectiveState({ priority_set_at: checkedAt, inactivity_days: 1 }, 7, nowMs);
        expect(oneDay.column).toBe('day-1');
        expect(oneDay.dueInDays).toBe(1);

        const sevenDays = effectiveState({ priority_set_at: checkedAt, inactivity_days: 7 }, 7, nowMs);
        expect(sevenDays.column).toBe('day-6');
        expect(sevenDays.dueInDays).toBe(7);

        const fourteenDays = effectiveState({ priority_set_at: checkedAt, inactivity_days: 14 }, 7, nowMs);
        expect(fourteenDays.column).toBe('day-6');
        expect(fourteenDays.dueInDays).toBe(14);

        const defaultFromNull = effectiveState({ priority_set_at: checkedAt, inactivity_days: null }, 7, nowMs);
        expect(defaultFromNull.column).toBe('day-6');
        expect(defaultFromNull.dueInDays).toBe(7);
    });

    describe('day rollover hour', () => {
        // Built in LOCAL time so the assertions hold in any machine timezone:
        // 02:00 and 06:00 straddle a 04:00 local rollover.
        const beforeRollover = new Date(2026, 0, 10, 2, 0, 0).getTime();
        const afterRollover = new Date(2026, 0, 10, 6, 0, 0).getTime();

        it('keeps the same board day for two instants in the same rollover window', () => {
            const lateYesterday = new Date(2026, 0, 9, 23, 0, 0).getTime(); // still "Jan 9" under a 4am rollover
            expect(boardDayIndex(beforeRollover, 4)).toBe(boardDayIndex(lateYesterday, 4));
            // After 04:00 it has advanced to the next board day.
            expect(boardDayIndex(afterRollover, 4)).toBe(boardDayIndex(beforeRollover, 4) + 1);
        });

        it('only advances a card toward Today once the rollover hour passes', () => {
            // Checked exactly 24h before the 02:00 reading, review cycle 7d.
            const checkedAt = new Date(new Date(2026, 0, 9, 2, 0, 0).getTime()).toISOString();
            const state = { priority_set_at: checkedAt, inactivity_days: 7 };

            // At 02:00 (before the 4am rollover) the reading and the check share the
            // same board day boundary spacing: one whole day has elapsed.
            const early = effectiveState(state, 7, beforeRollover, 4);
            // At 06:00 (after the rollover) the board has ticked one extra day.
            const late = effectiveState(state, 7, afterRollover, 4);
            expect(late.boardOffset).toBe(early.boardOffset - 1);
        });
    });
});
