#!/usr/bin/env node
// repo-triage — a small CLI companion for the repo.triage dashboard. It drives
// the same triage state by talking to the local HTTP API (the repo catalogue
// lives in the server's memory, merged with SQLite, so the server must be up).
//
//   repo-triage [--api <url>] [--json] <command> [args]
//
// See `repo-triage help`. Auth/GitHub access stays server-side; the CLI only
// reads/writes triage state, so it never needs a token of its own.
import { pathToFileURL } from 'node:url';

const VALUE_FLAGS = new Set(['api', 'days', 'owner', 'tag', 'language', 'lang']);

// ---- pure helpers (unit-tested) -------------------------------------------

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

export function apiBase(flags = {}) {
  if (typeof flags.api === 'string') return flags.api.replace(/\/$/, '');
  if (process.env.REPO_TRIAGE_API) return process.env.REPO_TRIAGE_API.replace(/\/$/, '');
  return `http://localhost:${process.env.PORT || 8787}`;
}

// Resolve "owner/name" or a bare "name" to exactly one repo, or throw.
export function resolveRepo(repos, ident) {
  const needle = String(ident || '').trim().toLowerCase();
  if (!needle) throw new Error('a repo (owner/name or name) is required');
  let matches = repos.filter((r) => (r.full_name || '').toLowerCase() === needle);
  if (matches.length === 0) matches = repos.filter((r) => (r.name || '').toLowerCase() === needle);
  if (matches.length === 0) throw new Error(`no repo matching "${ident}"`);
  if (matches.length > 1) {
    throw new Error(`"${ident}" is ambiguous — use owner/name. Matches: ${matches.map((r) => r.full_name).join(', ')}`);
  }
  return matches[0];
}

export function filterReposCli(repos, opts = {}) {
  const language = opts.language ?? opts.lang;
  return repos.filter((r) => {
    if (r.ignored && !opts.all && !opts.ignored) return false;
    if (opts.ignored && !r.ignored) return false;
    if (opts.owner && (r.owner || '').toLowerCase() !== String(opts.owner).toLowerCase()) return false;
    if (language && (r.language || '').toLowerCase() !== String(language).toLowerCase()) return false;
    if (opts.tag && !(r.tags || []).includes(String(opts.tag).toLowerCase())) return false;
    if (opts.due && !r.needsCheckToday) return false;
    return true;
  });
}

const dueLabel = (r) => (r.needsCheckToday ? 'today' : `in ${r.dueInDays}d`);

export function formatList(repos, { json = false } = {}) {
  if (json) {
    return JSON.stringify(
      repos.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        owner: r.owner,
        due: dueLabel(r),
        needsCheckToday: r.needsCheckToday,
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

async function withRepo(base, ident) {
  const { repos } = await getRepos(base);
  return resolveRepo(repos, ident);
}

const HELP = `repo-triage — CLI for the repo.triage dashboard

Usage: repo-triage [--api <url>] [--json] <command> [args]

Commands:
  list [--owner O] [--tag T] [--language L] [--due] [--ignored] [--all]
                              List repositories (hides ignored by default)
  tags                        List all tags with usage counts
  ignore   <repo>             Hide a repo from the board
  unignore <repo>             Un-ignore a repo
  check    <repo> [--days N]  Mark reviewed N days ago (default 0 = now)
  clear    <repo>             Clear the check date (back to "not checked")
  interval <repo> <days|default>   Set/reset the per-repo review interval
  tag add  <repo> <tag...>    Add one or more tags
  tag rm   <repo> <tag...>    Remove one or more tags
  note add <repo> <text...>   Attach a timestamped notice
  help

A repo is "owner/name" (or a bare "name" when unambiguous).
The server must be running; override its URL with --api or REPO_TRIAGE_API.`;

// ---- commands -------------------------------------------------------------

async function run(argv, out = console.log) {
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
    case 'ignore':
    case 'unignore': {
      const repo = await withRepo(base, positionals[0]);
      await call(base, 'POST', `/api/repos/${repo.id}/ignore`, { ignored: command === 'ignore' });
      out(`${command}d ${repo.full_name}`);
      return 0;
    }
    case 'check': {
      const repo = await withRepo(base, positionals[0]);
      const days = flags.days === undefined ? 0 : Number(flags.days);
      if (!Number.isFinite(days) || days < 0) throw new Error('--days must be a non-negative number');
      await call(base, 'POST', `/api/repos/${repo.id}/check`, { daysAgo: days });
      out(`checked ${repo.full_name} (${days}d ago)`);
      return 0;
    }
    case 'clear': {
      const repo = await withRepo(base, positionals[0]);
      await call(base, 'POST', `/api/repos/${repo.id}/priority`, { priority: null });
      out(`cleared check date for ${repo.full_name}`);
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
