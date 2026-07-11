import { useState } from 'react';
import { cx, ACCENT, ICON } from '../lib/constants.js';
import { devId } from '../lib/devIdOverlay.js';
import { useDialog } from '../lib/useDialog.js';

// Mobile-only day/bucket selector (see DESIGN.md → Mobile components → Day
// picker). A calendar-icon button showing the active column's title; tapping it
// opens a dropdown listing every board column — day columns or owner/tag/
// language buckets — with its title, subtitle, and a right-aligned count chip.
// Neutral chrome; the only colour is the per-column accent dot/title, exactly as
// in the column header.
export function DayPicker({ columns, activeKey, onSelect }) {
  const [open, setOpen] = useState(false);
  const CalendarIcon = ICON.calendar;
  const dialogRef = useDialog(() => setOpen(false));
  const active = columns.find((c) => c.key === activeKey) || columns[0];

  return (
    <div {...devId('DayPicker')} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Choose day${active ? `, currently ${active.title}` : ''}`}
        className="flex min-h-[44px] items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-200 hover:bg-neutral-800"
      >
        <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{active?.title ?? 'no columns'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Choose day"
            tabIndex={-1}
            className="absolute left-0 z-20 mt-1 max-h-[70vh] w-72 max-w-[90vw] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl"
          >
            {columns.map((col) => {
              const acc = ACCENT[col.accent] || ACCENT.neutral;
              const isActive = col.key === active?.key;
              return (
                <button
                  key={col.key}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    onSelect(col.key);
                    setOpen(false);
                  }}
                  className={cx(
                    'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md px-2 text-left transition-colors',
                    isActive ? 'bg-neutral-800' : 'hover:bg-neutral-800/60'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cx('h-2 w-2 shrink-0 rounded-full', acc.dot)} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col">
                      <span className={cx('truncate text-sm font-semibold', acc.head)}>{col.title}</span>
                      {col.subtitle && <span className="truncate text-[11px] text-neutral-600">{col.subtitle}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] tabular-nums text-neutral-300">
                    {col.count}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
