import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx, PRIORITY_FILTER_OPTIONS } from "../lib/constants.js";
import { devId } from "../lib/devIdOverlay.js";
import { useDialog } from "../lib/useDialog.js";
import { useIsMobile } from "../lib/useIsMobile.js";

function PriorityFilterPanel({ value, onChange, anchorRef, onClose }) {
  const [pos, setPos] = useState(null);
  const dialogRef = useDialog(onClose);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return undefined;
    const el = anchorRef?.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 176;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [anchorRef, isMobile]);

  const toggle = (level) =>
    onChange(
      value.includes(level)
        ? value.filter((l) => l !== level)
        : [...value, level],
    );

  return createPortal(
    <>
      <div
        className={cx("fixed inset-0 z-10", isMobile && "bg-black/50")}
        onClick={onClose}
      />
      <div
        {...devId("PriorityFilter")}
        ref={dialogRef}
        role="dialog"
        aria-label="Filter by priority"
        tabIndex={-1}
        className={cx(
          "fixed z-20 border border-neutral-700 bg-neutral-900 p-2 shadow-2xl",
          isMobile
            ? "inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg"
            : "w-44 rounded-lg",
        )}
        style={
          isMobile
            ? undefined
            : pos
              ? { top: pos.top, left: pos.left }
              : { visibility: "hidden" }
        }
      >
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            Filter by priority
          </span>
          {value.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[10px] text-neutral-400 hover:text-neutral-200"
            >
              clear
            </button>
          )}
        </div>
        {PRIORITY_FILTER_OPTIONS.map(({ level, label, title, dot }) => (
          <label
            key={level}
            title={title}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            <input
              type="checkbox"
              checked={value.includes(level)}
              onChange={() => toggle(level)}
              className="accent-neutral-500"
            />
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: dot }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{label}</span>
          </label>
        ))}
      </div>
    </>,
    document.body,
  );
}

export function PriorityFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  return (
    <>
      <button
        {...devId("PriorityFilter")}
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter by priority"
        aria-expanded={open}
        className={cx(
          "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
          value.length
            ? "border-neutral-600 bg-neutral-800 text-neutral-200"
            : "border-neutral-800 bg-transparent text-neutral-600",
        )}
      >
        <span
          className="text-[10px] font-bold tracking-tight"
          aria-hidden="true"
        >
          !
        </span>
        priority{value.length ? ` (${value.length})` : ""}
      </button>
      {open && (
        <PriorityFilterPanel
          value={value}
          onChange={onChange}
          anchorRef={btnRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
