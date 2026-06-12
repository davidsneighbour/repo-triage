import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialog } from '../lib/useDialog.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cx, tagColor, PRIORITY_LEVELS, PRIORITY_META } from '../lib/constants.js';

export function CardMenu({ repo, anchorRef, autoFocusTag = false, tagOnly = false, defaultInactivity, allTags = [], onSetChecked, onClearCheck, onSetPriority, onSetInactivity, onSetIgnored, onAddNotice, onViewNotices, onAddTag, onRemoveTag, onClose }) {
  const [days, setDays] = useState(repo.inactivity_days ?? '');
  const [notice, setNotice] = useState('');
  const [tag, setTag] = useState('');
  const [pos, setPos] = useState(null);
  const tagInputRef = useRef(null);
  const dialogRef = useDialog(onClose);
  // On mobile the menu renders as a full-width bottom sheet rather than an
  // anchored popover (see DESIGN.md → Mobile components → Bottom-sheet popovers).
  const isMobile = useIsMobile();

  // When opened via the card's "+ tag" affordance, jump focus to the tag input
  // (overriding useDialog's default focus) so the user can type immediately.
  useEffect(() => {
    if (autoFocusTag && tagInputRef.current) tagInputRef.current.focus();
  }, [autoFocusTag]);

  const submitTag = () => {
    const v = tag.trim();
    if (v) {
      onAddTag(repo.id, v);
      setTag('');
    }
  };

  // Anchor the popover to the trigger via fixed positioning so the column's
  // overflow-y-auto scroll area never clips it. Skipped on mobile, where the
  // menu is a bottom sheet pinned to the viewport edge instead.
  useEffect(() => {
    if (isMobile) return undefined;
    const el = anchorRef?.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 256;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRef, isMobile]);

  return createPortal(
    <>
      <div className={cx('fixed inset-0 z-10', isMobile && 'bg-black/50')} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={tagOnly ? `Tags for ${repo.name}` : `Settings for ${repo.name}`}
        tabIndex={-1}
        className={cx(
          'fixed z-20 border border-neutral-700 bg-neutral-900 p-2 shadow-2xl',
          isMobile
            ? 'inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg [&_button]:min-h-[44px]'
            : 'w-64 rounded-lg'
        )}
        style={isMobile ? undefined : pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        {!tagOnly && (
        <>
        <p className="px-1 pb-1 text-[10px] uppercase tracking-widest text-neutral-500">Review timing</p>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              onSetChecked(repo.id, 0);
              onClose();
            }}
            className="rounded-md bg-neutral-800 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
          >
            Checked now
          </button>
          <button
            onClick={() => {
              onSetChecked(repo.id, defaultInactivity);
              onClose();
            }}
            className="rounded-md bg-rose-500/20 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
          >
            Move to Today
          </button>
          <button
            onClick={() => {
              onClearCheck(repo.id);
              onClose();
            }}
            className="col-span-2 rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            Clear check date
          </button>
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Priority</label>
          <div className="mt-1 grid grid-cols-4 gap-1" role="group" aria-label="Set triage priority">
            {PRIORITY_LEVELS.map((level) => {
              const active = repo.priority === level;
              const meta = PRIORITY_META[level];
              return (
                <button
                  key={level}
                  aria-pressed={active}
                  title={meta.title}
                  onClick={() => onSetPriority(repo.id, active ? null : level)}
                  className={cx(
                    'rounded-md py-1 text-xs font-semibold',
                    active ? meta.chip : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
            <button
              aria-pressed={repo.priority == null}
              title="No priority"
              onClick={() => onSetPriority(repo.id, null)}
              className={cx(
                'rounded-md py-1 text-xs font-semibold',
                repo.priority == null ? 'bg-neutral-700 text-neutral-100' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              )}
            >
              None
            </button>
          </div>
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Review every (days)</label>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={days}
              placeholder={String(defaultInactivity)}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
            />
            <button
              onClick={() => {
                onSetInactivity(repo.id, days === '' ? null : Number(days));
                onClose();
              }}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-neutral-600">Blank = default ({defaultInactivity}d)</p>
        </div>
        </>
        )}

        <div className={cx('mt-2 pt-2', !tagOnly && 'border-t border-neutral-800')}>
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Tags</label>
          {repo.tags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {repo.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(t) }} aria-hidden="true" />
                  #{t}
                  <button onClick={() => onRemoveTag(repo.id, t)} aria-label={`Remove tag ${t}`} className="text-neutral-500 hover:text-rose-300">
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {(() => {
            const applied = new Set(repo.tags || []);
            const suggestions = (repo.topics || [])
              .map((t) => t.trim().toLowerCase().slice(0, 50))
              .filter((t) => t && !applied.has(t));
            if (suggestions.length === 0) return null;
            return (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-neutral-600">topics:</span>
                {suggestions.map((t) => (
                  <button
                    key={t}
                    onClick={() => onAddTag(repo.id, t)}
                    aria-label={`Add topic ${t} as tag`}
                    className="rounded-sm border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                  >
                    +{t}
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="mt-1 flex items-center gap-1">
            <input
              ref={tagInputRef}
              list="card-tag-suggestions"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitTag();
                }
              }}
              placeholder="add tag..."
              aria-label="New tag"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
            />
            <button
              disabled={tag.trim() === ''}
              onClick={submitTag}
              aria-label="Add tag"
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {allTags.length > 0 && (
            <datalist id="card-tag-suggestions">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}
        </div>

        {!tagOnly && (
        <>
        <div className="mt-2 border-t border-neutral-800 pt-2">
          <button
            onClick={() => {
              onSetIgnored(repo.id, !repo.ignored);
              onClose();
            }}
            className="w-full rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            {repo.ignored ? 'Unignore repo' : 'Ignore repo'}
          </button>
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Notice</label>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            placeholder="add a note..."
            aria-label="New notice"
            className="mt-1 w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
          />
          <div className="mt-1 flex items-center gap-1">
            <button
              disabled={notice.trim() === ''}
              onClick={() => {
                onAddNotice(repo.id, notice.trim());
                setNotice('');
                onClose();
              }}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => {
                onViewNotices(repo.id);
                onClose();
              }}
              className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              View all ({repo.notice_count ?? 0})
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </>,
    document.body
  );
}
