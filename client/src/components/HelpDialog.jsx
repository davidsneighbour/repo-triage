import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import helpMarkdown from "../help.md?raw";
import helpDiagramSvg from "../help-diagram.svg?raw";
import { devId } from "../lib/devIdOverlay.js";
import { useDialog } from "../lib/useDialog.js";

export function HelpDialog({ onClose }) {
  const dialogRef = useDialog(onClose);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId("HelpDialog")}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto max-h-[88vh] max-w-3xl overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2
              id="help-dialog-title"
              className="text-sm font-semibold text-neutral-100"
            >
              Help
            </h2>
            <p className="text-[11px] text-neutral-500">Press Esc to close</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            aria-label="Close help"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[calc(88vh-64px)] overflow-auto px-4 py-3 text-xs text-neutral-300">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h3 className="mb-2 text-sm font-semibold text-neutral-100">
                  {children}
                </h3>
              ),
              h2: ({ children }) => (
                <h4 className="mt-5 mb-2 border-t border-neutral-800 pt-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {children}
                </h4>
              ),
              h3: ({ children }) => (
                <h5 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  {children}
                </h5>
              ),
              p: ({ children }) => (
                <p className="mb-2 leading-relaxed text-neutral-300">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 list-disc space-y-1 pl-5 text-neutral-300">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 list-decimal space-y-1 pl-5 text-neutral-300">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-neutral-100">
                  {children}
                </strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  {children}
                </a>
              ),
              hr: () => <hr className="my-4 border-neutral-800" />,
              table: ({ children }) => (
                <div className="mb-3 overflow-auto">
                  <table className="w-full border-collapse text-[11px]">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-neutral-800 bg-neutral-950 px-2 py-1 text-left font-semibold text-neutral-200">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-neutral-800 px-2 py-1 align-top text-neutral-300">
                  {children}
                </td>
              ),
              code: ({ className, children }) => {
                const match = /language-(\w+)/.exec(className || "");

                // The flow diagram is pre-rendered to SVG at build time (see
                // scripts/build-help-diagram.mjs) so we never run Mermaid in the
                // browser — that rendering was unreliable and showed a fallback.
                if (match?.[1] === "mermaid") {
                  return (
                    <figure
                      role="img"
                      aria-label="Repo.triage data-loading flow diagram"
                      className="mb-3 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 [&>svg]:h-auto [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: helpDiagramSvg }}
                    />
                  );
                }

                return (
                  <code className="rounded-sm bg-neutral-950 px-1 py-0.5 text-[11px] text-neutral-200">
                    {children}
                  </code>
                );
              },
            }}
          >
            {helpMarkdown}
          </ReactMarkdown>
        </div>
      </section>
    </>
  );
}
