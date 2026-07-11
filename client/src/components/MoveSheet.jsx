import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';

// Quick-pick presets that fill the field; the field itself remains the single
// source of truth (see DESIGN.md → Mobile components → Move sheet).
const PRESETS = [1, 3, 7, 14, 30];

// Mobile-only long-press scheduler. A bottom sheet titled with the repo name
// whose sole control is a single numeric field — "mark done for N days". One
// number expresses both "move to a day" and "snooze for N days". The precise
// backend mapping is tracked in issue #17; the sheet stays decoupled by calling
// a single `onApply(id, days)` handler. Cancel closes without mutating.
export function MoveSheet({ repo, defaultInactivity = 7, onApply, onClose }) {
  const [days, setDays] = useState(String(Math.max(1, Number(defaultInactivity) || 7)));
  const dialogRef = useDialog(onClose);

  const submit = () => {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0 || days === '') return;
    onApply(repo.id, n);
    onClose();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      <div
        {...devId('MoveSheet')}
        ref={dialogRef}
        role="dialog"
        aria-label={`Reschedule ${repo.name}`}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-lg border-t border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
      >
        <p className="text-sm font-semibold text-neutral-100">{repo.name}</p>
        <label className="mt-3 block px-0.5 text-[10px] uppercase tracking-widest text-neutral-500" htmlFor="move-days">
          Mark done for (days)
        </label>
        <input
          id="move-days"
          type="number"
          min="0"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          className="mt-1 min-h-[44px] w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-base text-neutral-100 outline-hidden focus:border-neutral-500"
        />
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(String(p))}
              className="min-h-[44px] rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              {p}d
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={submit}
            className="min-h-[44px] flex-1 rounded-md bg-neutral-800 text-sm font-semibold text-neutral-100 hover:bg-neutral-700"
          >
            Mark done
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-md border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
