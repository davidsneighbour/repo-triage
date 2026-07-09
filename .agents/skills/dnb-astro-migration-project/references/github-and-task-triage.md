# GitHub And Task Triage

Use this reference when bootstrapping or maintaining the migration issue tree, `ROADMAP.md`, and `TODO.md`.

## Authority Model

- GitHub Issues are authoritative for actionable migration work.
- `MIGRATION.md` is authoritative for migration operating rules.
- `MIGRATION.status.md` is authoritative for route/system progress.
- `ROADMAP.md` is a generated project index and status cache.
- `TODO.md` is a scratchpad inbox for rough notes that are not actionable yet.

Use `dnb-project-task-triage` for status, roadmap regeneration, TODO sync, and issue reconciliation when it is available.

## Bootstrap Milestones

Create milestones like these, adapting names only when the repository has strong existing conventions:

- `Migration: Inventory`
- `Migration: Astro Foundation`
- `Migration: Content Parity`
- `Migration: Visual Parity`
- `Migration: Cleanup`
- `Migration: Post-Parity Improvements`

## Bootstrap Parent Issues

Create parent or tracking issues for:

- inventory current site for Astro migration;
- build Astro static-site foundation;
- migrate current content and route surface to Astro;
- verify visual and behavioral parity;
- clean up legacy migration leftovers after parity;
- track post-parity improvements;
- run periodic main-branch intake during migration.

When the issue tracker supports hierarchy or dependencies, link sub-issues to their parents and record blockers explicitly.

## Route And System Issues

After the inventory, create issues for route groups and shared systems, for example:

- top-level static pages;
- content collections such as projects, services, posts, products, case studies, or docs;
- taxonomy routes;
- shared assets and system files;
- forms;
- redirects and deprecated paths;
- widgets and embeds;
- screenshot parity workflow;
- parity checks across route groups;
- validation and quality gates;
- shared tooling and dependency policy;
- post-parity accessibility, SEO, performance, generated file, and integration improvements.

Each issue should include:

- source paths and target paths;
- parity requirements;
- acceptance criteria;
- known blockers or clarification questions;
- whether the issue is parity, cleanup, or post-parity improvement.

## Labels

Use existing labels where possible. Common useful labels:

- `type:chore`
- `type:enhancement`
- `type:tests`
- `status:confirmed`
- `prio:high`
- `prio:medium`
- `prio:low`

Do not invent labels if the repository has a different convention unless the user asks.

## ROADMAP.md Procedure

When regenerating `ROADMAP.md`, include:

- notice that `MIGRATION.md` governs the migration;
- project state summary;
- issue counts and active milestone;
- route/system status from `MIGRATION.status.md`;
- open issues grouped by milestone;
- recently closed migration issues;
- open clarification questions;
- recommended next steps.

Prefer generating this through `dnb-project-task-triage`. If that workflow is unavailable, state that the file was manually updated and why.

## TODO.md Procedure

Use `TODO.md` only for rough inbox items:

- unclear user notes;
- untriaged ideas;
- tasks that require a GitHub Issue before implementation.

Move actionable items into GitHub Issues as soon as practical. Keep `TODO.md` short and explicit.

## Main Branch Intake

When asked to keep up with `main`:

1. Fetch current refs.
2. Compare `main` with the migration branch.
3. Summarize relevant changes.
4. Classify changes as relevant, irrelevant, already covered, or requiring clarification.
5. Create or update GitHub Issues for relevant changes.
6. Port changes intentionally with issue-linked commits.

Do not blindly rebase, reset, or broad-merge `main` into the migration branch.
