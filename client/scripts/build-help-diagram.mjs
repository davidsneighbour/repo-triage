// Pre-renders the Mermaid flow diagram in src/help.md into a static SVG
// (src/help-diagram.svg) that ships with the client, so the help dialog never
// has to run Mermaid in the browser.
//
// This is wired into `prebuild`. It is best-effort: rendering Mermaid needs a
// headless browser via @mermaid-js/mermaid-cli (Puppeteer/Chromium). If that
// toolchain isn't installed, the script logs a notice and exits 0, leaving the
// committed SVG in place — so a normal `npm run build` never fails for missing
// Chromium. Run `npm run build:help-diagram` after editing the diagram, with
// the dev dependency installed:
//
//   npm install --no-save @mermaid-js/mermaid-cli
//   npm run build:help-diagram
//
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "..", "src");
const helpMd = path.join(srcDir, "help.md");
const outSvg = path.join(srcDir, "help-diagram.svg");

function extractMermaid(markdown) {
  const match = markdown.match(/```mermaid\s*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

async function main() {
  const markdown = await readFile(helpMd, "utf8");
  const diagram = extractMermaid(markdown);
  if (!diagram) {
    console.warn(
      "[help-diagram] No ```mermaid block found in help.md — nothing to render.",
    );
    return;
  }

  let run;
  try {
    ({ run } = await import("@mermaid-js/mermaid-cli"));
  } catch {
    console.warn(
      "[help-diagram] @mermaid-js/mermaid-cli not installed — keeping the committed src/help-diagram.svg.\n" +
        "               Run `npm install --no-save @mermaid-js/mermaid-cli && npm run build:help-diagram` to regenerate.",
    );
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "help-diagram-"));
  const inputPath = path.join(tmpDir, "diagram.mmd");
  try {
    await writeFile(inputPath, `${diagram}\n`, "utf8");
    await run(inputPath, outSvg, {
      quiet: true,
      puppeteerConfig: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
      parseMMDOptions: {
        backgroundColor: "transparent",
        mermaidConfig: {
          theme: "dark",
          securityLevel: "strict",
          flowchart: { useMaxWidth: true },
        },
      },
    });
    console.log(`[help-diagram] Rendered src/help-diagram.svg from help.md.`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  // Never fail the build for a diagram regeneration problem — ship the committed SVG.
  console.warn(`[help-diagram] Skipped regeneration: ${err?.message || err}`);
});
