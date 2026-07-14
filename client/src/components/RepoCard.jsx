import { memo, useRef, useState } from "react";
import {
  cx,
  ICON,
  ownerColor,
  PRIORITY_META,
  tagColor,
} from "../lib/constants.js";
import { timeAgo } from "../lib/date.js";
import { devId } from "../lib/devIdOverlay.js";
import { Badge } from "./Badge.jsx";
import { CardMenu } from "./CardMenu.jsx";
import { MoveSheet } from "./MoveSheet.jsx";

// Long-press tuning for the mobile move gesture.
const LONG_PRESS_MS = 450;
const MOVE_THRESHOLD_PX = 10;

function RepoCardImpl({
  repo,
  column,
  menuOpenId,
  menuIntent,
  showOwner,
  density = "comfortable",
  schedulable = true,
  mobile = false,
  fields = {},
  selected = false,
  onToggleSelect,
  onToggleMenu,
  onDragStartCard,
  onDropOnCard,
  onAnnounceMove,
  ...handlers
}) {
  // Field visibility: a field shows unless explicitly toggled off.
  const show = (k) => fields[k] !== false;
  const SettingsIcon = ICON.settings;
  const StarIcon = ICON.star;
  const IssueIcon = ICON.issues;
  const ForkIcon = ICON.forks;
  const TagIcon = ICON.tag;
  const PRIcon = ICON.pullRequest;
  const ReleaseIcon = ICON.release;
  const menuButtonRef = useRef(null);
  const ownerTint = showOwner && repo.owner ? ownerColor(repo.owner) : null;
  const compact = density === "compact";

  // Mobile-only long-press → move sheet. Additive to (not a replacement for)
  // the desktop drag/`[`/`]` paths, which stay untouched. A long press on the
  // card body (≥ LONG_PRESS_MS without moving past the threshold) opens the
  // MoveSheet; a plain tap still follows the repo link.
  const [moveOpen, setMoveOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pressTimer = useRef(null);
  const pressStart = useRef(null);
  const longPressed = useRef(false);
  const longPressEnabled = mobile && schedulable;

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const onPointerDown = (e) => {
    if (!longPressEnabled) return;
    // Don't hijack a press that starts on an interactive control (link, gear,
    // checkbox, tag button) — those have their own tap behaviour.
    if (e.target.closest("a,button,input,textarea,select")) return;
    longPressed.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMoveOpen(true);
      pressTimer.current = null;
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    if (!pressStart.current) return;
    const dx = Math.abs(e.clientX - pressStart.current.x);
    const dy = Math.abs(e.clientY - pressStart.current.y);
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) clearPress();
  };

  const onClickCapture = (e) => {
    // A long-press just opened the move sheet; swallow the click it would
    // otherwise become so the repo link doesn't also fire. Guard on DOM
    // containment: React portals (the move sheet) bubble through the React tree,
    // so without this the sheet's own buttons would be swallowed too.
    if (longPressed.current && e.currentTarget.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      longPressed.current = false;
    }
  };

  const onContextMenu = (e) => {
    // Suppress the native long-press context menu so it doesn't fight the move
    // gesture on touch.
    if (longPressEnabled) e.preventDefault();
  };

  const dueText = repo.needsCheckToday
    ? "review today"
    : `review in ${repo.dueInDays} days`;
  const cardLabel = `${repo.name}${repo.owner ? `, ${repo.owner}` : ""} — ${dueText}`;

  // Keyboard shortcuts on the focused card:
  //   Enter — open the card menu (when focus is on the card itself, not a child)
  //   [ / ] — move one column toward Today / further out (day-schedule board only)
  const onCardKeyDown = (e) => {
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "BUTTON"
    )
      return;
    if (e.key === "Enter" && e.target === e.currentTarget) {
      e.preventDefault();
      onToggleMenu(repo.id);
      return;
    }
    if (!schedulable || (e.key !== "[" && e.key !== "]")) return;
    e.preventDefault();
    const span = Math.max(1, handlers.defaultInactivity || 7);
    const cur = repo.boardOffset ?? 0;
    const next =
      e.key === "]" ? Math.min(span - 1, cur + 1) : Math.max(0, cur - 1);
    if (next !== cur) {
      const daysAgoTarget = span - next;
      handlers.onSetChecked(repo.id, daysAgoTarget);
      onAnnounceMove?.(repo.id, daysAgoTarget);
    }
  };

  return (
    <div
      {...devId("RepoCard")}
      draggable={schedulable}
      aria-grabbed={schedulable ? dragging : undefined}
      role="group"
      aria-label={cardLabel}
      aria-keyshortcuts={schedulable ? "Enter [ ]" : "Enter"}
      onKeyDown={onCardKeyDown}
      onPointerDown={longPressEnabled ? onPointerDown : undefined}
      onPointerMove={longPressEnabled ? onPointerMove : undefined}
      onPointerUp={longPressEnabled ? clearPress : undefined}
      onPointerCancel={longPressEnabled ? clearPress : undefined}
      onPointerLeave={longPressEnabled ? clearPress : undefined}
      onClickCapture={longPressEnabled ? onClickCapture : undefined}
      onContextMenu={longPressEnabled ? onContextMenu : undefined}
      onDragStart={
        schedulable
          ? (e) => {
              setDragging(true);
              onDragStartCard(e, repo.id);
            }
          : undefined
      }
      onClick={
        onToggleSelect
          ? (e) => {
              if (!e.target.closest("a, button, input, textarea, select"))
                onToggleSelect(repo.id);
            }
          : undefined
      }
      onDragEnd={schedulable ? () => setDragging(false) : undefined}
      onDragOver={schedulable ? (e) => e.preventDefault() : undefined}
      onDrop={
        schedulable
          ? (e) => {
              e.stopPropagation();
              e.preventDefault();
              const draggedId = Number(e.dataTransfer.getData("text/plain"));
              if (draggedId && draggedId !== repo.id)
                onAnnounceMove?.(draggedId, column.daysAgoTarget);
              onDropOnCard(e, repo.id, column.daysAgoTarget);
            }
          : undefined
      }
      style={
        ownerTint
          ? { borderLeftColor: ownerTint, borderLeftWidth: 3 }
          : undefined
      }
      className={cx(
        "group relative rounded-lg border bg-neutral-900/70 hover:border-neutral-700",
        selected
          ? "border-neutral-400 ring-1 ring-neutral-500"
          : "border-neutral-800",
        compact ? "p-2" : "p-3",
        longPressEnabled && "select-none",
      )}
    >
      <div
        className={cx(
          "flex items-start justify-between gap-2",
          schedulable && "cursor-grab",
        )}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(repo.id)}
            aria-label={`Select ${repo.name}`}
            className="mt-0.5 shrink-0 accent-neutral-400"
          />
        )}
        <div className="min-w-0 flex-1">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-neutral-100 hover:text-white hover:underline"
          >
            {repo.name}
          </a>
          {repo.description && (
            <p
              className={cx(
                "mt-0.5 text-xs text-neutral-500",
                compact ? "line-clamp-1" : "line-clamp-2",
              )}
            >
              {repo.description}
            </p>
          )}
        </div>
        <button
          ref={menuButtonRef}
          onClick={() => onToggleMenu(repo.id)}
          className="flex shrink-0 items-center justify-center rounded-md px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          aria-label="Open repository settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PRIORITY_META[repo.priority] && (
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
              PRIORITY_META[repo.priority].chip,
            )}
            title={PRIORITY_META[repo.priority].title}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: PRIORITY_META[repo.priority].dot }}
              aria-hidden="true"
            />
            {PRIORITY_META[repo.priority].label}
          </span>
        )}
        {ownerTint && (
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300"
            title={`owner: ${repo.owner}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ownerTint }}
              aria-hidden="true"
            />
            {repo.owner}
          </span>
        )}
        <Badge tone={repo.private ? "amber" : "emerald"}>
          {repo.private ? "private" : "public"}
        </Badge>
        {repo.archived ? (
          <Badge tone="neutral">archived</Badge>
        ) : (
          <Badge tone="sky">live</Badge>
        )}
        {repo.fork && <Badge tone="neutral">fork</Badge>}
        {repo.language && show("language") && (
          <Badge tone="violet">{repo.language}</Badge>
        )}
        {repo.ignored && <Badge tone="neutral">ignored</Badge>}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {repo.tags?.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tagColor(tag) }}
              aria-hidden="true"
            />
            #{tag}
          </span>
        ))}
        {!compact && (
          <button
            onClick={() => onToggleMenu(repo.id, "tag")}
            className="inline-flex items-center gap-0.5 rounded-sm border border-dashed border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            aria-label={`Add tag to ${repo.name}`}
          >
            <TagIcon className="h-2.5 w-2.5" aria-hidden="true" />
            tag
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span className="flex min-w-0 items-center gap-2">
          {!compact && show("pushed") && (
            <span className="truncate">pushed {timeAgo(repo.pushed_at)}</span>
          )}
          {show("stars") && repo.stargazers_count > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 tabular-nums"
              title={`${repo.stargazers_count} stargazers`}
            >
              <StarIcon className="h-3 w-3" aria-hidden="true" />
              {repo.stargazers_count}
            </span>
          )}
          {show("issues") && repo.open_issues_count > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 tabular-nums"
              title={`${repo.open_issues_count} open issues / PRs`}
            >
              <IssueIcon className="h-3 w-3" aria-hidden="true" />
              {repo.open_issues_count}
            </span>
          )}
          {show("forks") && repo.forks_count > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 tabular-nums"
              title={`${repo.forks_count} forks`}
            >
              <ForkIcon className="h-3 w-3" aria-hidden="true" />
              {repo.forks_count}
            </span>
          )}
          {show("open_prs") && repo.open_prs != null && repo.open_prs > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 tabular-nums"
              title={`${repo.open_prs} open PRs`}
            >
              <PRIcon className="h-3 w-3" aria-hidden="true" />
              {repo.open_prs}
            </span>
          )}
          {show("latest_release") && repo.latest_release?.tag && (
            <span
              className="flex shrink-0 items-center gap-0.5"
              title={`Latest release: ${repo.latest_release.tag}`}
            >
              <ReleaseIcon className="h-3 w-3" aria-hidden="true" />
              {repo.latest_release.tag}
            </span>
          )}
          {show("last_commit") && repo.last_commit?.date && (
            <span
              className="truncate"
              title={
                repo.last_commit.author
                  ? `Last commit by ${repo.last_commit.author}`
                  : "Last commit"
              }
            >
              commit {timeAgo(repo.last_commit.date)}
            </span>
          )}
          {show("ci_status") && repo.ci_status && (
            <span
              className={cx(
                "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase",
                repo.ci_status === "SUCCESS"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : repo.ci_status === "FAILURE" || repo.ci_status === "ERROR"
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-amber-500/15 text-amber-300",
              )}
              aria-label={`CI status: ${repo.ci_status.toLowerCase()}`}
              title={`CI: ${repo.ci_status}`}
            >
              <span aria-hidden="true">
                {repo.ci_status === "SUCCESS"
                  ? "✓"
                  : repo.ci_status === "FAILURE" || repo.ci_status === "ERROR"
                    ? "✗"
                    : "⏳"}
              </span>
              <span aria-hidden="true"> CI</span>
            </span>
          )}
        </span>
        {!compact && (
          <span className="shrink-0">
            {repo.checkedAgeDays == null
              ? "not checked yet"
              : repo.checkedAgeDays === 0
                ? "checked today"
                : `checked ${repo.checkedAgeDays}d ago`}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          {repo.needsCheckToday ? (
            <span className="text-rose-300">review today</span>
          ) : (
            <span>review in {repo.dueInDays}d</span>
          )}
          {schedulable && (
            <span
              className="opacity-0 transition-opacity group-focus-within:opacity-100 tabular-nums text-neutral-700"
              aria-hidden="true"
            >
              ← [ / ] →
            </span>
          )}
        </div>
      )}

      {repo.latest_notice && !compact && show("notice") && (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-surface-subtle px-2 py-1.5">
          <p className="line-clamp-2 text-[11px] text-neutral-300">
            {repo.latest_notice.body}
          </p>
          <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">
            {timeAgo(repo.latest_notice.created_at)}
          </span>
        </div>
      )}

      {menuOpenId === repo.id && (
        <CardMenu
          repo={repo}
          anchorRef={menuButtonRef}
          autoFocusTag={menuIntent === "tag"}
          tagOnly={menuIntent === "tag"}
          onClose={() => onToggleMenu(repo.id)}
          {...handlers}
        />
      )}

      {longPressEnabled && moveOpen && (
        <MoveSheet
          repo={repo}
          defaultInactivity={handlers.defaultInactivity}
          onApply={handlers.onSnooze}
          onClose={() => {
            setMoveOpen(false);
            longPressed.current = false;
          }}
        />
      )}
    </div>
  );
}

// Memoised so a selection toggle (or any unrelated board state change) only
// re-renders the card whose props actually changed — handlers are stable
// (useCallback in App) and `selected` is a per-card boolean.
export const RepoCard = memo(RepoCardImpl);
