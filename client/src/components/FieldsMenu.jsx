import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';
import { cx, FIELD_OPTIONS } from '../lib/constants.js';

function FieldsMenuPanel({ fields, onToggle, anchorRef, onClose }) {
  const [pos, setPos] = useState(null);
  const dialogRef = useDialog(onClose);

  useEffect(() => {
    const el = anchorRef?.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 176;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRef]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        {...devId('FieldsMenu')}
        ref={dialogRef}
        role="dialog"
        aria-label="Card fields"
        tabIndex={-1}
        className="fixed z-20 w-44 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        <span className="block px-1 pb-1 text-[10px] uppercase tracking-widest text-neutral-500">Show fields</span>
        {FIELD_OPTIONS.map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800">
            <input type="checkbox" checked={fields[key] !== false} onChange={() => onToggle(key)} className="accent-neutral-500" />
            <span className="flex-1 truncate">{label}</span>
          </label>
        ))}
      </div>
    </>,
    document.body
  );
}

export function FieldsMenu({ fields, onToggle }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const hiddenCount = FIELD_OPTIONS.filter((f) => fields[f.key] === false).length;
  return (
    <>
      <button
        {...devId('FieldsMenu')}
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Card fields"
        aria-expanded={open}
        className={cx(
          'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
          hiddenCount ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 bg-transparent text-neutral-600'
        )}
      >
        fields{hiddenCount ? ` (${FIELD_OPTIONS.length - hiddenCount}/${FIELD_OPTIONS.length})` : ''}
      </button>
      {open && <FieldsMenuPanel fields={fields} onToggle={onToggle} anchorRef={btnRef} onClose={() => setOpen(false)} />}
    </>
  );
}
