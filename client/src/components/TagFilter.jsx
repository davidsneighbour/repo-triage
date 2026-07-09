import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cx, ICON, tagColor } from '../lib/constants.js';

function RenameRow({ tag, onRename, onCancel }) {
  const [value, setValue] = useState(tag);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const next = value.trim();
    if (next && next !== tag) onRename(tag, next);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1 rounded-sm px-1 py-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        }}
        onKeyDownCapture={(e) => {
          // Intercept in the capture phase: useDialog's Escape-to-close listener
          // sits on the panel DOM node, an ancestor this event reaches during the
          // bubble phase before a plain onKeyDown here would fire — capture runs
          // first, so stopping propagation here keeps Escape scoped to cancelling
          // the rename instead of closing the whole popover.
          if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onCancel(); }
        }}
        aria-label={`Rename ${tag}`}
        className="w-full min-w-0 rounded-sm border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
      />
      <button type="button" onClick={submit} aria-label="Save rename" className="rounded-sm p-0.5 text-neutral-500 hover:text-emerald-300">
        <Check className="h-3 w-3" aria-hidden="true" />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel rename" className="rounded-sm p-0.5 text-neutral-500 hover:text-neutral-200">
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function DeleteConfirmRow({ tag, count, onConfirm, onCancel }) {
  const [resetCheck, setResetCheck] = useState(false);
  return (
    <div className="rounded-sm bg-neutral-800/60 px-1 py-1 text-[11px] text-neutral-300">
      <p className="px-0.5">
        Delete <span className="font-medium">#{tag}</span> from all {count} rep{count === 1 ? 'o' : 'os'}?
      </p>
      <label className="mt-1 flex cursor-pointer items-center gap-1.5 px-0.5 text-[10px] text-neutral-400">
        <input type="checkbox" checked={resetCheck} onChange={(e) => setResetCheck(e.target.checked)} className="accent-neutral-500" />
        also reset check status for affected repos
      </label>
      <div className="mt-1 flex items-center gap-1 px-0.5">
        <button
          type="button"
          onClick={() => onConfirm(resetCheck)}
          className="rounded-sm bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/30"
        >
          Delete
        </button>
        <button type="button" onClick={onCancel} className="rounded-sm px-1 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CreateTagRow({ onCreate, existing }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const next = value.trim();
    if (!next || existing.includes(next.toLowerCase())) return;
    onCreate(next);
    setValue('');
  };
  return (
    <div className="mt-1 flex items-center gap-1 border-t border-neutral-800 pt-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        }}
        placeholder="new tag..."
        aria-label="New tag name"
        className="w-full min-w-0 rounded-sm border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
      />
      <button
        type="button"
        disabled={value.trim() === ''}
        onClick={submit}
        aria-label="Create tag"
        className="flex items-center gap-0.5 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        add
      </button>
    </div>
  );
}

function TagFilterPanel({ available, value, onChange, onDelete, onCreate, onRename, anchorRef, onClose }) {
  const [pos, setPos] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [confirmTag, setConfirmTag] = useState(null);
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

  const renameTag = (from, to) => {
    onRename(from, to);
    setEditingTag(null);
  };

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
                  available.map(({ tag, count }) => {
                    if (editingTag === tag) {
                      return <RenameRow key={tag} tag={tag} onRename={renameTag} onCancel={() => setEditingTag(null)} />;
                    }
                    if (confirmTag === tag) {
                      return (
                        <DeleteConfirmRow
                          key={tag}
                          tag={tag}
                          count={count}
                          onConfirm={(resetCheck) => {
                            onDelete(tag, resetCheck);
                            setConfirmTag(null);
                          }}
                          onCancel={() => setConfirmTag(null)}
                        />
                      );
                    }
                    return (
                      <div key={tag} className="group flex items-center gap-2 rounded-sm px-1 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 truncate">
                          <input type="checkbox" checked={selected.includes(tag)} onChange={() => toggleTag(tag)} className="accent-neutral-500" />
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} aria-hidden="true" />
                          <span className="flex-1 truncate">#{tag}</span>
                        </label>
                        <span className="tabular-nums text-neutral-600">{count}</span>
                        {onRename && (
                          <button
                            type="button"
                            onClick={() => setEditingTag(tag)}
                            aria-label={`Rename tag ${tag}`}
                            title={`Rename tag #${tag}`}
                            className="rounded-sm p-0.5 text-neutral-600 hover:text-neutral-200 focus:text-neutral-200"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmTag(tag)}
                            aria-label={`Delete tag ${tag}`}
                            title={`Delete tag #${tag} everywhere`}
                            className="rounded-sm p-0.5 text-neutral-600 hover:text-rose-300 focus:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {onCreate && <CreateTagRow onCreate={onCreate} existing={available.map((t) => t.tag)} />}
      </div>
    </>,
    document.body
  );
}

export function TagFilter({ available, value, onChange, onDelete, onCreate, onRename }) {
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
      {open && (
        <TagFilterPanel
          available={available}
          value={value}
          onChange={onChange}
          onDelete={onDelete}
          onCreate={onCreate}
          onRename={onRename}
          anchorRef={btnRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
