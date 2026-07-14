import fs from "node:fs";
import path from "node:path";
import db from "../db.js";
import { buildReport, REPORT_KINDS, toCsv, toMarkdown } from "../report.js";
import { parseCron } from "./cron.js";
import { buildPayload } from "./payload.js";

const scheduleGetStmt = db.prepare(
  `SELECT value FROM settings WHERE key = 'report_schedule'`,
);
const scheduleUpsertStmt = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES ('report_schedule', ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const lastExportGetStmt = db.prepare(
  `SELECT value FROM settings WHERE key = 'report_last_export'`,
);
const lastExportUpsertStmt = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES ('report_last_export', ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

export function getScheduleConfig() {
  const row = scheduleGetStmt.get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function setScheduleConfig(config) {
  scheduleUpsertStmt.run(JSON.stringify(config), new Date().toISOString());
}

export function getLastExport() {
  const row = lastExportGetStmt.get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function setLastExport(info) {
  lastExportUpsertStmt.run(JSON.stringify(info), new Date().toISOString());
}

// De-dup guard: track the last minute we ran an export to avoid running twice
// in the same minute (the sync loop calls this after every refresh).
let _lastExportedMinute = -1;

export function checkReportSchedule(now = new Date()) {
  const config = getScheduleConfig();
  if (!config?.cron || !config?.outputPath) return;

  const minuteKey = Math.floor(now.getTime() / 60_000);
  if (minuteKey === _lastExportedMinute) return;

  let matches;
  try {
    matches = parseCron(config.cron)(now);
  } catch (e) {
    console.error("[report-schedule] invalid cron expression:", e.message);
    return;
  }
  if (!matches) return;

  _lastExportedMinute = minuteKey;
  runExport(config).catch((e) =>
    console.error("[report-schedule] export error:", e.message),
  );
}

async function runExport(config) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = String(config.outputPath);

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    setLastExport({
      timestamp: new Date().toISOString(),
      status: "error",
      error: `cannot create outputPath: ${e.message}`,
    });
    return;
  }

  const payload = buildPayload();
  const files = [];
  const errors = [];

  for (const kind of REPORT_KINDS) {
    try {
      const report = buildReport(kind, payload, {});
      const base = `${kind}-${ts}`;
      fs.writeFileSync(path.join(outputDir, `${base}.md`), toMarkdown(report));
      fs.writeFileSync(path.join(outputDir, `${base}.csv`), toCsv(report));
      files.push(`${base}.md`, `${base}.csv`);
    } catch (e) {
      errors.push(`${kind}: ${e.message}`);
    }
  }

  setLastExport({
    timestamp: new Date().toISOString(),
    status: errors.length ? (files.length ? "partial" : "error") : "ok",
    outputPath: outputDir,
    files,
    ...(errors.length && { errors }),
  });
}
