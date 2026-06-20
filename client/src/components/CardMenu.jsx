import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialog } from '../lib/useDialog.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cx, tagColor, PRIORITY_LEVELS, PRIORITY_META, FLAG_NAMES, FLAG_META } from '../lib/constants.js';

export function CardMenu({ repo, anchorRef, autoFocusTag = false, tagOnly = false, defaultInactivity, allTags = [], onSetChecked, onClearCheck, onSetPriority, onSetInactivity, onSetIgnored, onAddNotice, onViewNotices, onAddTag, onRemoveTag, onAddFlag, onRemoveFlag, onGhPrs, onGhCreateIssue, onClose }) {
  const [days, setDays] = useState(repo.inactivity_days ?? '');
  const [notice, setNotice] = useState('');
  const [tag, setTag] = useState('');
  // GitHub quick-action state
  const [prsState, setPrsState] = useState(null); // null | 'loading' | {prs} | {error}
  const [copiedUrl, setCopiedUrl] = useState(null); // null | 'https' | 'ssh'
  const [issueStep, setIssueStep] = useState(null); // null | 'form' | 'confirm' | 'done'
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [issueDone, setIssueDone] = useState(null); // {url, number} on success
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
      const top = r.bottom + 4;
      const maxHeight = window.innerHeight - top - 8;
      setPos({ top, left, maxHeight });
    };
    update();
    let raf;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
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
            ? 'inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg [&_button]:min-h-11'
            : 'w-64 overflow-y-auto rounded-lg'
        )}
        style={isMobile ? undefined : pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { visibility: 'hidden' }}
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
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Flags</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {FLAG_NAMES.map((f) => {
              const active = (repo.flags || []).includes(f);
              const meta = FLAG_META[f];
              return (
                <button
                  key={f}
                  aria-pressed={active}
                  title={meta.label}
                  onClick={() => active ? onRemoveFlag(repo.id, f) : onAddFlag(repo.id, f)}
                  className={cx(
                    'rounded-md px-2 py-1 text-[11px]',
                    active ? 'bg-neutral-700 text-neutral-100' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                  )}
                >
                  <span aria-hidden="true">{meta.emoji}</span>{' '}{meta.label}
                </button>
              );
            })}
          </div>
        </div>

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

        {(onGhPrs || onGhCreateIssue) && (
        <div className="mt-2 border-t border-neutral-800 pt-2">
          <p className="px-1 pb-1 text-[10px] uppercase tracking-widest text-neutral-500">GitHub actions</p>
          <div className="flex flex-col gap-1">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="rounded-md bg-neutral-800 py-1 text-center text-[11px] text-neutral-300 hover:bg-neutral-700"
            >
              View on GitHub ↗
            </a>
            <div className="flex gap-1">
              {(['https', 'ssh']).map((kind) => {
                const url = kind === 'https'
                  ? `https://github.com/${repo.full_name}.git`
                  : `git@github.com:${repo.full_name}.git`;
                const copied = copiedUrl === kind;
                return (
                  <button
                    key={kind}
                    onClick={() => {
                      navigator.clipboard?.writeText(url).then(() => {
                        setCopiedUrl(kind);
                        setTimeout(() => setCopiedUrl(null), 1500);
                      });
                    }}
                    className="flex-1 rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
                  >
                    {copied ? 'Copied!' : `Copy ${kind.toUpperCase()}`}
                  </button>
                );
              })}
            </div>

            {onGhPrs && (
              <>
                <button
                  onClick={async () => {
                    if (prsState?.prs) { setPrsState(null); return; }
                    setPrsState('loading');
                    try {
                      const d = await onGhPrs(repo.id);
                      setPrsState({ prs: d.prs ?? [] });
                    } catch {
                      setPrsState({ error: 'gh failed — is gh installed and authenticated?' });
                    }
                  }}
                  className="rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
                >
                  {prsState === 'loading' ? 'loading PRs…' : prsState?.prs ? `Hide PRs (${prsState.prs.length})` : 'List open PRs'}
                </button>
                {prsState?.error && (
                  <p role="alert" className="px-1 text-[10px] text-rose-400">{prsState.error}</p>
                )}
                {prsState?.prs && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950 p-1 text-[10px]">
                    {prsState.prs.length === 0
                      ? <li className="px-1 py-0.5 text-neutral-600">No open PRs</li>
                      : prsState.prs.map((pr) => (
                          <li key={pr.number}>
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate rounded px-1 py-0.5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                              title={pr.title}
                            >
                              #{pr.number} {pr.title}
                            </a>
                          </li>
                        ))
                    }
                  </ul>
                )}
              </>
            )}

            {onGhCreateIssue && issueStep == null && (
              <button
                onClick={() => setIssueStep('form')}
                className="rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
              >
                New issue…
              </button>
            )}
            {onGhCreateIssue && issueStep === 'form' && (
              <div className="flex flex-col gap-1 rounded-md border border-neutral-800 p-2">
                <input
                  type="text"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Issue title (required)"
                  aria-label="Issue title"
                  className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
                />
                <textarea
                  value={issueBody}
                  onChange={(e) => setIssueBody(e.target.value)}
                  placeholder="Body (optional)"
                  aria-label="Issue body"
                  rows={2}
                  className="resize-none rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
                />
                <div className="flex gap-1">
                  <button
                    disabled={!issueTitle.trim()}
                    onClick={() => setIssueStep('confirm')}
                    className="flex-1 rounded bg-neutral-700 py-1 text-[11px] text-neutral-100 hover:bg-neutral-600 disabled:opacity-40"
                  >
                    Create issue
                  </button>
                  <button
                    onClick={() => { setIssueStep(null); setIssueTitle(''); setIssueBody(''); }}
                    className="rounded px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {onGhCreateIssue && issueStep === 'confirm' && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                <p className="mb-1 font-medium">Create issue on GitHub?</p>
                <p className="mb-2 break-all text-amber-300/80">&ldquo;{issueTitle}&rdquo;</p>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      setIssueStep('done');
                      try {
                        const d = await onGhCreateIssue(repo.id, issueTitle.trim(), issueBody.trim());
                        setIssueDone({ url: d.url, number: d.number });
                      } catch {
                        setIssueDone({ error: 'gh failed — is gh installed and authenticated?' });
                      }
                    }}
                    className="flex-1 rounded bg-amber-700/60 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-700/80"
                  >
                    Yes, create
                  </button>
                  <button
                    onClick={() => setIssueStep('form')}
                    className="rounded px-2 py-1 text-[11px] text-amber-300/60 hover:text-amber-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {onGhCreateIssue && issueStep === 'done' && (
              issueDone?.error
                ? <p role="alert" className="px-1 text-[10px] text-rose-400">{issueDone.error}</p>
                : issueDone
                  ? <a href={issueDone.url} target="_blank" rel="noreferrer" className="block rounded-md bg-neutral-800 py-1 text-center text-[11px] text-green-400 hover:bg-neutral-700">
                      Issue #{issueDone.number} created ↗
                    </a>
                  : <p className="px-1 text-[10px] text-neutral-600">Creating…</p>
            )}
          </div>
        </div>
        )}

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
