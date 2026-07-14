import { X } from "lucide-react";
import { devId } from "../lib/devIdOverlay.js";

// Transient bottom-centre notification with an optional Undo action. One at a
// time; the parent auto-dismisses it after a few seconds.
export function Toast({ message, onUndo, onDismiss }) {
  return (
    <div
      {...devId("Toast")}
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-2xl"
    >
      <span>{message}</span>
      {onUndo && (
        <button
          onClick={onUndo}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-neutral-500 hover:text-neutral-200"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
