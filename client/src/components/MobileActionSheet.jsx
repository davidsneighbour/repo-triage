import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { devId } from "../lib/devIdOverlay.js";
import { useDialog } from "../lib/useDialog.js";

// Generic mobile bottom sheet used to hold the collapsed toolbar controls (see
// DESIGN.md → Mobile components → Mobile toolbar & action sheet). Slides up from
// the bottom edge; the backdrop scrim closes it. The controls inside keep their
// desktop semantics — this only relocates them.
export function MobileActionSheet({ title = "Options", onClose, children }) {
  const dialogRef = useDialog(onClose);
  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      <div
        {...devId("MobileActionSheet")}
        ref={dialogRef}
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-lg border-t border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close options"
            className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </>,
    document.body,
  );
}
