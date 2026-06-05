import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cx, ICON, tagColor } from '../lib/constants.js';

function TagFilterPanel({ available, value, onChange, onDelete, anchorRef, onClose }) {
  const [pos, setPos] = useState(null);
  const dialogRef = useDialog(onClose);
  const isMobile = useIsMobile();
  const selected = value.tags;

  useEffect(() => {
    if (isMobile) return undefined;
    const el = anchorRef?.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 224;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRef, isMobile]);

  const toggleTag = (tag) =>
    onChange({ ...value, tags: selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag] });

  return createPortal(
    <>
      <div className={cx('fixed inset-0 z-10', isMobile && 'bg-black/50')} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Filter by tag"
        tabIndex={-1}
        className={cx(
          'fixed z-20 border border-neutral-700 bg-neutral-900 p-2 shadow-2xl',
          isMobile ? 'inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg' : 'w-56 rounded-lg'
        )}
        style={isMobile ? undefined : pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">Filter by tag</span>
                {selected.length > 0 && (
                  <button onClick={() => onChange({ tags: [], mode: value.mode })} className="text-[10px] text-neutral-400 hover:text-neutral-200">
                    clear
                  </button>
                )}
              </div>
              {selected.length >= 2 && (
                <div className="mb-1 flex overflow-hidden rounded-md border border-neutral-700 text-[10px]">
                  {['any', 'all'].map((m) => (
                    <button
                      key={m}
                      onClick={() => onChange({ ...value, mode: m })}
                      className={cx('flex-1 px-2 py-0.5', value.mode === m ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                    >
                      match {m}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-auto">
                {available.length === 0 ? (
                  <p className="px-1 py-2 text-center text-[11px] text-neutral-600">no tags yet</p>
                ) : (
                  available.map(({ tag, count }) => (
                    <div key={tag} className="group flex items-center gap-2 rounded-sm px-1 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 truncate">
                        <input type="checkbox" checked={selected.includes(tag)} onChange={() => toggleTag(tag)} className="accent-neutral-500" />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} aria-hidden="true" />
                        <span className="flex-1 truncate">#{tag}</span>
                      </label>
                      <span className="tabular-nums text-neutral-600">{count}</span>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete tag "#${tag}" from all ${count} rep${count === 1 ? 'o' : 'os'}?`)) onDelete(tag);
                          }}
                          aria-label={`Delete tag ${tag}`}
                          title={`Delete tag #${tag} everywhere`}
                          className="rounded-sm p-0.5 text-neutral-600 hover:text-rose-300 focus:text-rose-300"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
      </div>
    </>,
    document.body
  );
}

export function TagFilter({ available, value, onChange, onDelete }) {
  const TagIcon = ICON.tag;
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const selected = value.tags;
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter by tag"
        aria-expanded={open}
        className={cx(
          'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
          selected.length ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 bg-transparent text-neutral-600'
        )}
      >
        <TagIcon className="h-3 w-3" aria-hidden="true" />
        tags{selected.length ? ` (${selected.length})` : ''}
      </button>
      {open && <TagFilterPanel available={available} value={value} onChange={onChange} onDelete={onDelete} anchorRef={btnRef} onClose={() => setOpen(false)} />}
    </>
  );
}
