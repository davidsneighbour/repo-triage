import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { cx, REPORT_LABELS } from "../lib/constants.js";
import { devId } from "../lib/devIdOverlay.js";
import { useDialog } from "../lib/useDialog.js";

export function ReportsDialog({ onClose }) {
  const [kinds, setKinds] = useState(["summary"]);
  const [kind, setKind] = useState("summary");
  const [view, setView] = useState("table");
  const [report, setReport] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const dialogRef = useDialog(onClose);

  useEffect(() => {
    api
      .reportKinds()
      .then((d) => {
        if (d?.kinds?.length) setKinds(d.kinds);
      })
      .catch(() => {
        /* no-op */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    const days = kind === "stale" ? 180 : undefined;
    const done = (fn) => (val) => {
      if (cancelled) return;
      fn(val);
      setLoading(false);
    };
    if (view === "table") {
      api
        .report(kind, { days })
        .then(done(setReport))
        .catch(done(() => setReport(null)));
    } else {
      api
        .report(kind, { format: view === "markdown" ? "md" : "csv", days })
        .then(done(setText))
        .catch(done(() => setText("")));
    }
    return () => {
      cancelled = true;
    };
  }, [kind, view]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId("ReportsDialog")}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="reports-dialog-title"
              className="text-sm font-semibold text-neutral-100"
            >
              Reports
            </h2>
            <p className="text-[11px] text-neutral-500">
              {report?.title || REPORT_LABELS[kind] || kind}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
              {["table", "markdown", "csv"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cx(
                    "px-2 py-1",
                    view === v
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-800",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              aria-label="Close reports"
              className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-1 border-b border-neutral-800 px-4 py-2">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cx(
                "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                kind === k
                  ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                  : "border-neutral-800 text-neutral-500 hover:bg-neutral-800",
              )}
            >
              {REPORT_LABELS[k] || k}
            </button>
          ))}
        </div>

        <div className="overflow-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-neutral-600">
              loading...
            </p>
          ) : view === "table" ? (
            !report || report.rows.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-700">
                no matching repositories
              </p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr>
                    {report.columns.map((c) => (
                      <th
                        key={c}
                        className="border-b border-neutral-800 px-2 py-1 font-medium text-neutral-400"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-900/60">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="border-b border-neutral-800/60 px-2 py-1 tabular-nums text-neutral-300"
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div>
              <div className="mb-1 flex justify-end">
                <button
                  onClick={copy}
                  className="rounded-md border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-800"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <pre className="overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-[11px] text-neutral-300">
                {text}
              </pre>
            </div>
          )}
        </div>
      </section>
    </>,
    document.body,
  );
}
