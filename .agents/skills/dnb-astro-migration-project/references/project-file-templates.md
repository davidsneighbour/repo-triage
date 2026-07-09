# Project File Templates

Use these templates to bootstrap a migration project. Replace bracketed placeholders with repository-specific facts. Keep wording imperative and agent-facing where the file is primarily for agents.

## AGENTS.md

```markdown
# Agent Onboarding

This repository is currently in an Astro migration on the `migration` branch and branches whose names start with `migration`.

When a user says something like "migrate this repo to Astro", "work on the migration", "what is next", or "check project status", the agent MUST orient itself from the migration tracking system before editing files.

## Migration Startup

For migration work, the agent MUST read these files first:

1. `MIGRATION.md`
2. `MIGRATION.status.md`
3. `ROADMAP.md`
4. `TODO.md`

Then the agent MUST inspect the relevant GitHub Issues. GitHub Issues are the source of truth for actionable migration work.

If the user asks for status, next steps, project triage, roadmap updates, or TODO/GitHub issue sync, the agent MUST use the `dnb-project-task-triage` skill when available.

## Branch Rules

Agents MUST work only on branches whose names start with `migration` unless the user explicitly says otherwise.

Agents MUST NOT perform migration work on `main`, `legacy/*`, or unrelated branches.

## Clarification Rules

Agents MUST ask only one blocking clarification question at a time.

Agents MUST record answered migration decisions in `MIGRATION.md`, `MIGRATION.status.md`, `PROJECT.md`, or GitHub Issues before continuing.

## Editing Rules

Agents MUST preserve user changes in the worktree.

Agents MUST keep commits topic-coherent and reference related GitHub Issues with `closes #123`, `see #123`, or similar wording.

Agents MUST NOT hand-maintain `ROADMAP.md` or `TODO.md` outside the `dnb-project-task-triage` workflow when that workflow is available.

Before finishing migration work, agents MUST review whether the change requires updates to `MIGRATION.md`, `MIGRATION.status.md`, `PROJECT.md`, `ROADMAP.md`, `TODO.md`, `AGENTS.md`, or GitHub Issues.
```

## PROJECT.md

```markdown
# Project

## Summary

- Repository: `[repository name]`
- Site: `[site URL or unknown]`
- Current system: `[system classification]`
- Target system: Astro static site
- Deployment target: `[Netlify/Vercel/GitHub Pages/custom/unknown]`
- Source of truth for parity: `[public/live/source directory]`

## Migration Goal

The first migration goal is parity with the current public website: visible design, behavior, content, metadata, URLs, assets, forms, redirects, and deployment behavior.

Improvements are tracked separately as post-parity work.

## Decisions

| Date | Decision | Source |
| --- | --- | --- |
| `[YYYY-MM-DD]` | Target Astro static output. | `[issue or user decision]` |

## Constraints

- Work on `migration*` branches unless explicitly directed otherwise.
- Preserve user changes.
- Use GitHub Issues for actionable migration work.
- Ask one blocking clarification question at a time.
```

## README.md

```markdown
# [Project Name]

[Short human-readable project description.]

## Astro Migration

This repository is being migrated to Astro. Migration operating rules live in `MIGRATION.md`, and route/system progress lives in `MIGRATION.status.md`.

## Local Commands

Document the active commands after the Astro foundation exists:

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run test`

## Deployment

[Deployment notes.]
```

## MIGRATION.md

```markdown
# Astro Migration Operating Instructions

This file defines the working rules for migrating `[project]` to Astro 7 or newer.

The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used as described in RFC 2119.

## Current Decision Summary

- Target platform: Astro 7 or newer.
- Site output: static unless an issue records why SSR is required.
- Source of truth for the current website: `[path/live URL/source]`.
- First milestone: visual, behavioral, content, metadata, URL, asset, form, and redirect parity.
- Progress tracker: `MIGRATION.status.md`.
- Project task source of truth: GitHub Issues.
- Generated project overview: `ROADMAP.md`, managed by `dnb-project-task-triage` when available.
- Scratchpad inbox: `TODO.md`, managed by `dnb-project-task-triage` when available.

## Agent Startup Checklist

Before making migration changes, an agent MUST:

1. Read this file.
2. Read `MIGRATION.status.md`.
3. Read `ROADMAP.md`.
4. Read `TODO.md`.
5. Inspect relevant GitHub Issues.
6. Confirm the current Git branch starts with `migration`.
7. Confirm the intended work has one or more GitHub Issues.

If any check fails, the agent MUST stop and ask one clarification question or create the missing tracking issue before editing implementation files.

## Source Preservation

Before replacing the current source-of-truth artifact, preserve it under `backup/`. Do not overwrite existing backups.

## Migration Goal

Recreate the current public website in Astro with the same visible design, content, behavior, metadata, URL surface, assets, forms, redirects, and deployment behavior, except where a GitHub Issue records an accepted removal or disparity.

## GitHub Issue Tracking

Every migration task, blocker, disparity, improvement idea, and scope decision MUST have a GitHub Issue when GitHub is available.

Commits MUST reference relevant issue numbers.

## ROADMAP.md and TODO.md

GitHub Issues are authoritative. `ROADMAP.md` is a generated project index. `TODO.md` is a scratchpad inbox.

Do not hand-maintain `ROADMAP.md` or `TODO.md` when `dnb-project-task-triage` is available.

## Tracking File Review

Every material migration change MUST include a review of whether `MIGRATION.md`, `MIGRATION.status.md`, `PROJECT.md`, `ROADMAP.md`, `TODO.md`, `AGENTS.md`, or GitHub Issues need updates.
```

## MIGRATION.status.md

```markdown
# Astro Migration Status

This file tracks visible migration progress for the Astro migration described in `MIGRATION.md`.

GitHub Issues remain the source of truth for tasks. This file answers: "How close are we to the same website on Astro?"

## Summary

Status basis: `[local scan/live crawl/date]`.

Resolved means `done + removed`.

| Done | In progress | Untouched | Removed | Total | Resolved |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 | 0 | 0% |

## Status Values

- `untouched`: not migrated yet.
- `in progress`: migration work has started but parity is not accepted.
- `done`: migrated and parity-checked.
- `removed`: intentionally not migrated; redirect or equivalent handling is tracked.

## Page and Route Inventory

| Source path | Target path | Status | Issue | Notes |
| --- | --- | --- | --- | --- |
| `/` | `/` | untouched | TBD | Home page. |

## Asset and System Inventory

| Area | Status | Issue | Notes |
| --- | --- | --- | --- |
| Images and media | untouched | TBD | Preserve required public assets. |
| PDFs and downloads | untouched | TBD | Keep required downloads available. |
| CSS and theme files | untouched | TBD | Refactor only after parity. |
| JavaScript and plugins | untouched | TBD | Preserve behavior first. |
| Forms | untouched | TBD | Preserve current flow first. |
| Redirects | untouched | TBD | Track removed and moved paths. |

## Accepted Disparities

None yet.

## Open Inventory Questions

- TBD.
```

## ROADMAP.md

```markdown
# Project Roadmap

This file is generated and maintained by the `dnb-project-task-triage` workflow when available. GitHub Issues are the source of truth.

Current migration work is governed by `MIGRATION.md`, with route and system progress tracked in `MIGRATION.status.md`.

## Project State

TBD.

## Open Issues

TBD.

## Recommended Next Steps

1. Bootstrap or sync GitHub Issues.
2. Complete source-system and route inventory.
3. Preserve the source of truth.
4. Initialize the Astro foundation.
```

## TODO.md

```markdown
# TODO

This file is the scratchpad inbox for rough, unclear, or intentionally unprocessed notes. GitHub Issues are the source of truth for actionable work.

No unprocessed TODO items are currently recorded.
```
