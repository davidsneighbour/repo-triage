import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import { restartIssueSyncInterval } from "./lib/issueSync.js";
import { buildPayload } from "./lib/payload.js";
import {
  getEffectiveSyncIntervalMinutes,
  ISSUE_SYNC_INTERVAL_MINUTES_ENV,
  SYNC_AUTO,
  SYNC_ON_STARTUP,
} from "./lib/settings.js";
import { queueRefresh, refreshRepos, restartSyncInterval } from "./lib/sync.js";
import ghRouter from "./routes/gh.js";
import issuesRouter from "./routes/issues.js";
import reposRouter from "./routes/repos.js";
import settingsRouter from "./routes/settings.js";
import settingsSetsRouter from "./routes/settingsSets.js";
import syncRouter from "./routes/sync.js";
import tagRulesRouter from "./routes/tagrules.js";
import tokensRouter from "./routes/tokens.js";
import undoRouter from "./routes/undo.js";
import webhookRouter from "./routes/webhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

// Local-dev-only HTTPS via locally-trusted certs (mkcert). Off by default —
// existing plain-HTTP workflows are unaffected unless HTTPS_ENABLED is set.
// See CLAUDE.md "Local dev — HTTPS (mkcert)".
const HTTPS_ENABLED = /^(1|true)$/i.test(process.env.HTTPS_ENABLED || "");
const HTTPS_CERT_FILE =
  process.env.HTTPS_CERT_FILE ||
  path.join(__dirname, "..", "certs", "dev-cert.pem");
const HTTPS_KEY_FILE =
  process.env.HTTPS_KEY_FILE ||
  path.join(__dirname, "..", "certs", "dev-key.pem");

const app = express();

// Webhook must be mounted before express.json() so it can use its own raw body parser.
app.use("/api", webhookRouter);

app.use(express.json());

app.use("/api", reposRouter);
app.use("/api", syncRouter);
app.use("/api", settingsRouter);
app.use("/api", ghRouter);
app.use("/api", tagRulesRouter);
app.use("/api", tokensRouter);
app.use("/api", undoRouter);
app.use("/api", issuesRouter);
app.use("/api", settingsSetsRouter);

// ---- Static client (built by Vite) ----------------------------------------
// Bootstrap-only: present a production build when one exists. Route tests import
// the app without a build, so this branch and the listen loop below are not
// exercised by the in-process suite.
/* v8 ignore start */
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback. Express 5 (path-to-regexp v8) rejects a bare '*' path, so use
  // a RegExp route to serve index.html for any GET not matched above.
  app.get(/.*/, (req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

function onListening() {
  const displayHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  const scheme = HTTPS_ENABLED ? "https" : "http";
  console.log(
    `\n  Repo Triage Dashboard -> ${scheme}://${displayHost}:${PORT}`,
  );
  if (HOST === "0.0.0.0" || HOST === "::") {
    console.log(
      `  Listening on all network interfaces, including ${scheme}://<your-lan-ip>:${PORT}`,
    );
  }
  console.log("");
  console.log(
    `  Sync on startup: ${SYNC_ON_STARTUP} | Auto-sync: ${SYNC_AUTO} every ${getEffectiveSyncIntervalMinutes()}m`,
  );

  if (SYNC_ON_STARTUP) {
    queueRefresh();
    console.log("  Background GitHub sync started.");
  }

  if (SYNC_AUTO) {
    restartSyncInterval(getEffectiveSyncIntervalMinutes());
    // Issue sync runs on its own (coarser) interval — not on startup — to
    // bound GitHub API cost across every tracked, opted-in repo.
    restartIssueSyncInterval(ISSUE_SYNC_INTERVAL_MINUTES_ENV);
  }
}

function startServer() {
  if (!HTTPS_ENABLED) {
    app.listen(PORT, HOST, onListening);
    return;
  }
  let cert;
  let key;
  try {
    cert = fs.readFileSync(HTTPS_CERT_FILE);
    key = fs.readFileSync(HTTPS_KEY_FILE);
  } catch (e) {
    console.error(
      `HTTPS_ENABLED is set but the certificate could not be read: ${e.message}`,
    );
    console.error(
      "Generate local certs first: npm run certs:generate (requires mkcert)",
    );
    process.exit(1);
    return;
  }
  https.createServer({ cert, key }, app).listen(PORT, HOST, onListening);
}

// Only boot the HTTP server + sync loop when run directly (node index.js).
// When imported by tests, the app is exported untouched so routes can be
// exercised with supertest against an in-process instance.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startServer();

/* v8 ignore stop */

export { app, buildPayload, refreshRepos };
