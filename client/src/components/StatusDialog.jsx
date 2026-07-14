import { Info, X } from "lucide-react";
import { cx } from "../lib/constants.js";
import { timeAgo } from "../lib/date.js";
import { devId } from "../lib/devIdOverlay.js";
import { useDialog } from "../lib/useDialog.js";

const ownerLink = (login) => (
  <a
    key={login}
    href={`https://github.com/${login}`}
    target="_blank"
    rel="noreferrer"
    className="text-emerald-300 hover:underline"
  >
    @{login}
  </a>
);

export function StatusDialog({ data, onClose }) {
  const dialogRef = useDialog(onClose);
  const rl = data.rateLimit;
  const pct = rl?.limit
    ? Math.round(((rl.limit - rl.remaining) / rl.limit) * 100)
    : null;
  const resetTime = rl?.reset
    ? new Date(rl.reset * 1000).toLocaleTimeString()
    : null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId("StatusDialog")}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-20 z-40 mx-auto max-w-sm overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            <h2
              id="status-dialog-title"
              className="text-sm font-semibold text-neutral-100"
            >
              Dashboard status
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            aria-label="Close status"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="divide-y divide-neutral-800 text-xs text-neutral-300">
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                Owners
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.owners?.length ? (
                data.owners.map((o) => ownerLink(o))
              ) : (
                <span className="text-neutral-400">authenticated user</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Repositories
              </div>
              <div className="mt-0.5 font-medium text-neutral-100">
                {data.repos.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Review cycle
              </div>
              <div className="mt-0.5 font-medium text-neutral-100">
                {data.defaultInactivityDays}d
              </div>
            </div>
          </div>

          {data.lastFetch && (
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Last synced
              </div>
              <div className="mt-0.5 text-neutral-300">
                {timeAgo(data.lastFetch)}
              </div>
            </div>
          )}

          {rl?.remaining != null && (
            <div className="px-4 py-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                GitHub API rate limit
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={cx(
                    "tabular-nums",
                    rl.remaining === 0
                      ? "text-rose-300"
                      : rl.remaining < 100
                        ? "text-amber-300"
                        : "text-neutral-200",
                  )}
                >
                  {rl.remaining} remaining
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {rl.used ?? "?"}/{rl.limit ?? "?"} used
                </span>
              </div>
              {pct != null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={cx(
                      "h-full rounded-full transition-all",
                      rl.remaining === 0
                        ? "bg-rose-500"
                        : pct > 80
                          ? "bg-amber-500"
                          : "bg-emerald-600",
                    )}
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              )}
              {resetTime && (
                <div className="text-[10px] text-neutral-600">
                  Resets at {resetTime}
                </div>
              )}
            </div>
          )}

          {data.sourceWarnings?.length > 0 && (
            <div className="px-4 py-3">
              <div className="mb-1.5 text-[10px] uppercase tracking-widest text-amber-500">
                Warnings
              </div>
              <div className="space-y-1 text-amber-200">
                {data.sourceWarnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
