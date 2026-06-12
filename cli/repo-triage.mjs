#!/usr/bin/env node
/**
 * @module cli/repo-triage
 * @description Zero-dependency CLI companion for the repo-triage dashboard.
 *   Scripts triage state by talking to the local HTTP API — the server must
 *   be running (`npm run server`). Auth and GitHub access stay server-side;
 *   the CLI only reads/writes triage state and never needs a token.
 *
 *   Usage: `repo-triage [--api <url>] [--json] <command> [args]`
 *
 *   Run `repo-triage help` to list all commands.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const VALUE_FLAGS = new Set(['api', 'days', 'owner', 'tag', 'language', 'lang', 'format', 'all-matching']);

// ---- pure helpers (unit-tested) -------------------------------------------

/**
 * Parses a raw `process.argv`-style array into a structured command object.
 * `--flag` becomes `{ flags: { flag: true } }`; `--flag value` or `--flag=value`
 * becomes `{ flags: { flag: 'value' } }` for flags listed in `VALUE_FLAGS`.
 *
 * @param {string[]} argv - Arguments array (typically `process.argv.slice(2)`).
 * @returns {{ command: string|undefined, positionals: string[], flags: Record<string, string|boolean> }}
 * @example
 * parseArgs(['list', '--owner', 'davidsneighbour', '--json']);
 * // { command: 'list', positionals: [], flags: { owner: 'davidsneighbour', json: true } }
 */
export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        if (VALUE_FLAGS.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          flags[key] = argv[++i];
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(a);
    }
  }
  const [command, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

/**
 * Resolves the API base URL from `flags.api`, the `REPO_TRIAGE_API` env var,
 * or the default `http://localhost:{PORT}`.
 *
 * @param {Record<string, string|boolean>} [flags={}] - Parsed CLI flags.
 * @returns {string} Base URL with no trailing slash.
 */
export function apiBase(flags = {}) {
  if (typeof flags.api === 'string') return flags.api.replace(/\/$/, '');
  if (process.env.REPO_TRIAGE_API) return process.env.REPO_TRIAGE_API.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT || 8787}`;
}

/**
 * Resolves an `"owner/name"` or bare `"name"` identifier to exactly one repo
 * from the list, or throws a descriptive error.
 *
 * Resolution order: exact full_name → exact name → name substring (fuzzy).
 *
 * @param {object[]} repos - Board payload array (from `GET /api/repos`).
 * @param {string} ident - Repository identifier (`"owner/name"` or `"name"`).
 * @returns {object} The matched repo object.
 * @throws {Error} If `ident` is empty, matches nothing, or is ambiguous.
 */
export function resolveRepo(repos, ident) {
  const needle = String(ident || '').trim().toLowerCase();
  if (!needle) throw new Error('a repo (owner/name or name) is required');
  let matches = repos.filter((r) => (r.full_name || '').toLowerCase() === needle);
  if (matches.length === 0) matches = repos.filter((r) => (r.name || '').toLowerCase() === needle);
  if (matches.length === 0) matches = repos.filter((r) => (r.name || '').toLowerCase().includes(needle));
  if (matches.length === 0) throw new Error(`no repo matching "${ident}"`);
  if (matches.length > 1) {
    throw new Error(`"${ident}" is ambiguous — use owner/name. Matches: ${matches.map((r) => r.full_name).join(', ')}`);
  }
  return matches[0];
}

/**
 * Resolves one or more repos for a bulk operation.
 *
 * - If `opts['all-matching']` is set: returns all repos whose `full_name` or
 *   `name` matches the glob pattern (`*` is a wildcard, case-insensitive).
 * - Otherwise: delegates to `resolveRepo(repos, ident)` and wraps in an array.
 *
 * @param {object[]} repos - Board payload array.
 * @param {string|undefined} ident - Single-repo identifier (ignored when `opts['all-matching']` is set).
 * @param {object} [opts={}] - Parsed CLI flags.
 * @returns {object[]} One or more matched repo objects.
 * @throws {Error} If the pattern matches nothing or `ident` resolves to nothing.
 */
export function resolveRepos(repos, ident, opts = {}) {
  const pattern = opts['all-matching'];
  if (pattern) {
    const re = new RegExp(
      '^' + String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      'i'
    );
    const filtered = repos.filter((r) => re.test(r.full_name || '') || re.test(r.name || ''));
    if (filtered.length === 0) throw new Error(`no repos matching "${pattern}"`);
    return filtered;
  }
  return [resolveRepo(repos, ident)];
}

/**
 * Filters the repo list by CLI options. All filters are additive (AND).
 *
 * @param {object[]} repos - Board payload array.
 * @param {object} [opts={}] - Filter options.
 * @param {boolean} [opts.all] - Include ignored repos.
 * @param {boolean} [opts.ignored] - Show only ignored repos.
 * @param {string} [opts.owner] - Filter by owner login (case-insensitive).
 * @param {string} [opts.language] - Filter by primary language (case-insensitive). Alias: `opts.lang`.
 * @param {string} [opts.tag] - Filter to repos carrying this tag.
 * @param {boolean} [opts.due] - Filter to repos due today.
 * @param {string|number} [opts.priority] - Comma list of priority levels; `"none"` matches unset.
 * @returns {object[]} Filtered subset of `repos`.
 */
export function filterReposCli(repos, opts = {}) {
  const language = opts.language ?? opts.lang;
  return repos.filter((r) => {
    if (r.ignored && !opts.all && !opts.ignored) return false;
    if (opts.ignored && !r.ignored) return false;
    if (opts.owner && (r.owner || '').toLowerCase() !== String(opts.owner).toLowerCase()) return false;
    if (language && (r.language || '').toLowerCase() !== String(language).toLowerCase()) return false;
    if (opts.tag && !(r.tags || []).includes(String(opts.tag).toLowerCase())) return false;
    if (opts.due && !r.needsCheckToday) return false;
    if (opts.priority !== undefined) {
      // --priority accepts a comma list of levels; "none" matches an unset one.
      const wanted = String(opts.priority)
        .split(',')
        .map((p) => (p.trim().toLowerCase() === 'none' ? 0 : Number(p.trim())));
      if (!wanted.includes(r.priority ?? 0)) return false;
    }
    return true;
  });
}

const dueLabel = (r) => (r.needsCheckToday ? 'today' : `in ${r.dueInDays}d`);

/**
 * Formats a repo list as either a compact aligned table or a JSON string.
 *
 * @param {object[]} repos - Repos to format.
 * @param {object} [options={}]
 * @param {boolean} [options.json=false] - Emit JSON instead of a text table.
 * @returns {string} Formatted output ready for `process.stdout`.
 */
export function formatList(repos, { json = false } = {}) {
  if (json) {
    return JSON.stringify(
      repos.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        owner: r.owner,
        due: dueLabel(r),
        needsCheckToday: r.needsCheckToday,
        priority: r.priority ?? null,
        tags: r.tags || [],
        ignored: Boolean(r.ignored),
        language: r.language || null,
        stargazers_count: r.stargazers_count ?? 0,
      })),
      null,
      2
    );
  }
  if (repos.length === 0) return 'no repositories match.';
  const rows = repos.map((r) => [
    r.full_name || r.name || String(r.id),
    dueLabel(r),
    (r.tags || []).map((t) => `#${t}`).join(' ') || '-',
    r.ignored ? 'ignored' : '',
  ]);
  const widths = [0, 1, 2].map((c) => Math.max(...rows.map((row) => row[c].length)));
  return rows
    .map((row) => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padEnd(widths[2])}  ${row[3]}`.trimEnd())
    .join('\n');
}

// ---- HTTP -----------------------------------------------------------------

async function call(base, method, path, body) {
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`could not reach the repo.triage API at ${base}. Is the server running? (npm run server)`);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `API ${res.status} on ${method} ${path}`);
  return data;
}

const getRepos = (base) => call(base, 'GET', '/api/repos');

// Raw-text GET (reports can come back as markdown/csv, not JSON).
async function callText(base, path) {
  let res;
  try {
    res = await fetch(`${base}${path}`);
  } catch {
    throw new Error(`could not reach the repo.triage API at ${base}. Is the server running? (npm run server)`);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = `API ${res.status} on GET ${path}`;
    try {
      const j = JSON.parse(text);
      if (j.error) msg = j.error;
    } catch {
      /* not json */
    }
    throw new Error(msg);
  }
  return text;
}

async function withRepo(base, ident) {
  const { repos } = await getRepos(base);
  return resolveRepo(repos, ident);
}

async function withRepos(base, ident, flags) {
  const { repos } = await getRepos(base);
  return resolveRepos(repos, ident, flags);
}

const HELP = `repo-triage — CLI for the repo.triage dashboard

Usage: repo-triage [--api <url>] [--json] <command> [args]

Commands:
  list [--owner O] [--tag T] [--language L] [--priority L] [--due] [--ignored] [--all]
                              List repositories (hides ignored by default).
                              --priority takes a comma list of 1|2|3|none
  tags                        List all tags with usage counts
  open     <repo>             Open the repo on GitHub in the browser (requires gh)
  ignore   <repo>             Hide a repo from the board
  unignore <repo>             Un-ignore a repo
  check    <repo> [--days N]  Mark reviewed N days ago (default 0 = now)
  clear    <repo>             Clear the check date (back to "not checked")
  priority <repo> <1|2|3|none>   Set/clear the triage priority
  interval <repo> <days|default>   Set/reset the per-repo review interval
  tag add  <repo> <tag...>    Add one or more tags
  tag rm   <repo> <tag...>    Remove one or more tags
  note add <repo> <text...>   Attach a timestamped notice
  report <kind> [--format md|csv|json] [--days N]
                              Print a report. Kinds: summary, due,
                              never-reviewed, stale, owners, languages,
                              archived, active, weekly
  backup                      Print all local triage state as JSON (redirect it)
  restore  <file.json>        Replace all triage state from a backup file
  help

A repo is "owner/name", a bare "name" (unambiguous), or a name substring (fuzzy).
Add --all-matching <glob> to any repo command to act on every matching repo
  e.g.  repo-triage check --all-matching "me/*" --days 1
        repo-triage ignore --all-matching "*/archived-*"
The server must be running; override its URL with --api or REPO_TRIAGE_API.`;

// ---- commands -------------------------------------------------------------

async function run(argv, out = console.log, { execFile = execFileSync } = {}) {
  const { command, positionals, flags } = parseArgs(argv);
  const base = apiBase(flags);

  if (!command || command === 'help' || flags.help) {
    out(HELP);
    return 0;
  }

  switch (command) {
    case 'list': {
      const { repos } = await getRepos(base);
      out(formatList(filterReposCli(repos, flags), flags));
      return 0;
    }
    case 'tags': {
      const { tags } = await call(base, 'GET', '/api/tags');
      out(flags.json ? JSON.stringify(tags, null, 2) : tags.map((t) => `${String(t.count).padStart(4)}  #${t.tag}`).join('\n') || 'no tags yet.');
      return 0;
    }
    case 'open': {
      const repos = await withRepos(base, positionals[0], flags);
      for (const repo of repos) {
        execFile('gh', ['repo', 'view', '--web', repo.full_name], { stdio: 'inherit' });
        out(`opened ${repo.full_name}`);
      }
      return 0;
    }
    case 'ignore':
    case 'unignore': {
      const repos = await withRepos(base, positionals[0], flags);
      for (const repo of repos) {
        await call(base, 'POST', `/api/repos/${repo.id}/ignore`, { ignored: command === 'ignore' });
        out(`${command}d ${repo.full_name}`);
      }
      return 0;
    }
    case 'check': {
      const repos = await withRepos(base, positionals[0], flags);
      const days = flags.days === undefined ? 0 : Number(flags.days);
      if (!Number.isFinite(days) || days < 0) throw new Error('--days must be a non-negative number');
      for (const repo of repos) {
        await call(base, 'POST', `/api/repos/${repo.id}/check`, { daysAgo: days });
        out(`checked ${repo.full_name} (${days}d ago)`);
      }
      return 0;
    }
    case 'clear': {
      const repos = await withRepos(base, positionals[0], flags);
      for (const repo of repos) {
        await call(base, 'POST', `/api/repos/${repo.id}/clear`);
        out(`cleared check date for ${repo.full_name}`);
      }
      return 0;
    }
    case 'priority': {
      const repos = await withRepos(base, positionals[0], flags);
      const raw = positionals[1];
      const priority = raw === 'none' || raw === 'clear' || raw === undefined ? null : Number(raw);
      if (priority !== null && ![1, 2, 3].includes(priority)) {
        throw new Error('usage: priority <repo> <1|2|3|none>');
      }
      for (const repo of repos) {
        await call(base, 'POST', `/api/repos/${repo.id}/priority`, { priority });
        out(`set priority for ${repo.full_name} to ${priority === null ? 'none' : `P${priority}`}`);
      }
      return 0;
    }
    case 'interval': {
      const repo = await withRepo(base, positionals[0]);
      const raw = positionals[1];
      const days = raw === 'default' || raw === undefined ? null : Number(raw);
      if (days !== null && (!Number.isFinite(days) || days < 0)) throw new Error('interval days must be a non-negative number or "default"');
      await call(base, 'POST', `/api/repos/${repo.id}/inactivity`, { days });
      out(`set review interval for ${repo.full_name} to ${days === null ? 'default' : `${days}d`}`);
      return 0;
    }
    case 'tag': {
      const sub = positionals[0];
      const repo = await withRepo(base, positionals[1]);
      const tags = positionals.slice(2);
      if (tags.length === 0) throw new Error('at least one tag is required');
      if (sub === 'add') {
        for (const t of tags) await call(base, 'POST', `/api/repos/${repo.id}/tags`, { tag: t });
        out(`tagged ${repo.full_name}: ${tags.map((t) => `#${t.toLowerCase()}`).join(' ')}`);
      } else if (sub === 'rm' || sub === 'remove') {
        for (const t of tags) await call(base, 'DELETE', `/api/repos/${repo.id}/tags/${encodeURIComponent(t.toLowerCase())}`);
        out(`untagged ${repo.full_name}: ${tags.map((t) => `#${t.toLowerCase()}`).join(' ')}`);
      } else {
        throw new Error('usage: tag add|rm <repo> <tag...>');
      }
      return 0;
    }
    case 'report': {
      const kind = positionals[0];
      if (!kind) throw new Error('usage: report <kind> [--format md|csv|json] [--days N]');
      const format = flags.format || (flags.json ? 'json' : 'md');
      const qs = new URLSearchParams({ format });
      if (flags.days !== undefined) qs.set('days', String(flags.days));
      const text = await callText(base, `/api/reports/${encodeURIComponent(kind)}?${qs}`);
      out(format === 'json' ? JSON.stringify(JSON.parse(text), null, 2) : text.replace(/\n$/, ''));
      return 0;
    }
    case 'backup': {
      // Print the full triage-state backup to stdout (redirect to a file).
      const data = await call(base, 'GET', '/api/backup');
      out(JSON.stringify(data, null, 2));
      return 0;
    }
    case 'restore': {
      const file = positionals[0];
      if (!file) throw new Error('usage: restore <file.json>');
      let payload;
      try {
        payload = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        throw new Error(`could not read backup file "${file}": ${e.message}`);
      }
      const res = await call(base, 'POST', '/api/restore', payload);
      const r = res.restored || {};
      out(`restored ${r.repo_state ?? 0} states, ${r.repo_notice ?? 0} notices, ${r.repo_tag ?? 0} tags`);
      return 0;
    }
    case 'note': {
      if (positionals[0] !== 'add') throw new Error('usage: note add <repo> <text...>');
      const repo = await withRepo(base, positionals[1]);
      const body = positionals.slice(2).join(' ').trim();
      if (!body) throw new Error('note text is required');
      await call(base, 'POST', `/api/repos/${repo.id}/notices`, { body });
      out(`added note to ${repo.full_name}`);
      return 0;
    }
    default:
      throw new Error(`unknown command "${command}". Try: repo-triage help`);
  }
}

export { run };

// ---- entrypoint -----------------------------------------------------------
// Bootstrap-only: exercised when run as a binary, not when imported by tests.
/* v8 ignore start */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code || 0),
    (err) => {
      console.error(`error: ${err.message}`);
      process.exit(1);
    }
  );
}
/* v8 ignore stop */
