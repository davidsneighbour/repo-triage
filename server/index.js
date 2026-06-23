import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import reposRouter from './routes/repos.js';
import syncRouter from './routes/sync.js';
import settingsRouter from './routes/settings.js';
import ghRouter from './routes/gh.js';
import tagRulesRouter from './routes/tagrules.js';
import tokensRouter from './routes/tokens.js';
import webhookRouter from './routes/webhook.js';
import undoRouter from './routes/undo.js';

import { SYNC_ON_STARTUP, SYNC_AUTO, getEffectiveSyncIntervalMinutes } from './lib/settings.js';
import { refreshRepos, queueRefresh, restartSyncInterval } from './lib/sync.js';
import { buildPayload } from './lib/payload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// Webhook must be mounted before express.json() so it can use its own raw body parser.
app.use('/api', webhookRouter);

app.use(express.json());

app.use('/api', reposRouter);
app.use('/api', syncRouter);
app.use('/api', settingsRouter);
app.use('/api', ghRouter);
app.use('/api', tagRulesRouter);
app.use('/api', tokensRouter);
app.use('/api', undoRouter);

// ---- Static client (built by Vite) ----------------------------------------
// Bootstrap-only: present a production build when one exists. Route tests import
// the app without a build, so this branch and the listen loop below are not
// exercised by the in-process suite.
/* v8 ignore start */
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback. Express 5 (path-to-regexp v8) rejects a bare '*' path, so use
  // a RegExp route to serve index.html for any GET not matched above.
  app.get(/.*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

function startServer() {
  app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
    console.log(`\n  Repo Triage Dashboard -> http://${displayHost}:${PORT}`);
    if (HOST === '0.0.0.0' || HOST === '::') {
      console.log(`  Listening on all network interfaces, including http://<your-lan-ip>:${PORT}`);
    }
    console.log('');
    console.log(`  Sync on startup: ${SYNC_ON_STARTUP} | Auto-sync: ${SYNC_AUTO} every ${getEffectiveSyncIntervalMinutes()}m`);

    if (SYNC_ON_STARTUP) {
      queueRefresh();
      console.log('  Background GitHub sync started.');
    }

    if (SYNC_AUTO) {
      restartSyncInterval(getEffectiveSyncIntervalMinutes());
    }
  });
}

// Only boot the HTTP server + sync loop when run directly (node index.js).
// When imported by tests, the app is exported untouched so routes can be
// exercised with supertest against an in-process instance.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startServer();
/* v8 ignore stop */

export { app, refreshRepos, buildPayload };
