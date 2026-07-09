---
id: dnb-astro-migration-project
name: dnb-astro-migration-project
title: DNB Astro Migration Project
type: skill
description: Bootstrap and run a parity-first migration of an existing website to Astro. Use when the user asks to "migrate this repo to Astro", start an Astro migration project, create migration docs, triage an existing static/CMS/SSG site before moving it to Astro, set up issue-backed migration tracking, or recreate a repository process with AGENTS, PROJECT, README, MIGRATION, ROADMAP, TODO, and GitHub Issues.
---

Use this skill to turn an existing website repository into an issue-backed Astro migration project. Default to a static Astro target, with the first milestone set to visual, behavioral, URL, content, metadata, asset, form, and redirect parity.

## Overview

The migration process is documentation-led and GitHub-Issue-backed. Do not start moving files or writing Astro components until source-system triage, tracking files, and initial issues exist.

## Core Rules

- Preserve user changes in the worktree.
- Work on `migration` or a branch whose name starts with `migration`, unless the user explicitly chooses another branch.
- Treat GitHub Issues as the source of truth for actionable work when GitHub is available.
- Treat `ROADMAP.md` as a generated project index and `TODO.md` as a scratchpad inbox.
- Use the `dnb-project-task-triage` skill whenever the user asks for status, next steps, project triage, roadmap updates, TODO sync, or GitHub issue sync.
- Ask only one blocking clarification question at a time. Record the answer in `MIGRATION.md`, `MIGRATION.status.md`, `PROJECT.md`, or a GitHub Issue before continuing.
- Separate parity work from improvements. Preserve existing behavior first; create post-parity issues for better implementations.

## Startup Workflow

1. Inspect the repository before editing:
   - branch and dirty worktree;
   - `AGENTS.md`, `PROJECT.md`, `README.md`, `MIGRATION.md`, `MIGRATION.status.md`, `ROADMAP.md`, and `TODO.md` when they exist;
   - package/config/build/deploy files;
   - visible source, generated output, and backup directories.
2. Triage the current site system and source of truth. Read [source-system-triage.md](references/source-system-triage.md) before deciding what to keep, remove, defer, or ask about.
3. If migration project files are missing, create them from [project-file-templates.md](references/project-file-templates.md).
4. If GitHub Issues are available, create or update the issue tree from [github-and-task-triage.md](references/github-and-task-triage.md). If GitHub is unavailable, create TODO inbox items that explicitly say they must become GitHub Issues before implementation.
5. If the user only wants a reusable prompt instead of files, read [starter-prompt.md](references/starter-prompt.md) and adapt it to the repository.

## Migration File Rules

Create or update these files during project bootstrap:

- `AGENTS.md`: agent onboarding, branch rules, startup checklist, issue rules, and tracking-file review.
- `PROJECT.md`: project context, target, deployment, known constraints, and decision log.
- `README.md`: human project overview and local commands.
- `MIGRATION.md`: authoritative migration operating instructions.
- `MIGRATION.status.md`: route, asset, system, redirect, form, widget, and accepted-disparity tracker.
- `ROADMAP.md`: generated overview managed through `dnb-project-task-triage` when available.
- `TODO.md`: scratchpad inbox managed through `dnb-project-task-triage` when available.

Do not hand-maintain `ROADMAP.md` or `TODO.md` when the task-triage workflow is available. Update `MIGRATION.status.md` directly when route or system statuses change.

## Keep, Remove, Defer

Keep anything required for parity: public URLs, page content, metadata, images, PDFs/downloads, styles, essential scripts, forms, redirects, robots/favicons, widgets, analytics, and deployment behavior.

Remove or redirect only when evidence shows something is generated cruft, obsolete admin/editor/CMS UI, unused build output, stale backup material, old dependency cache, or an implementation detail not meant for the public site. If public usage is unclear, ask one question and track the decision.

Defer improvements that are not required for parity: accessibility upgrades, SEO rewrites, performance refactors, new form backends, cleaner widget packaging, image pipelines, and Astro-native generation of files that can initially be passed through.

## Completion Review

Before finishing any migration task, review whether the change requires updates to:

- `MIGRATION.md`;
- `MIGRATION.status.md`;
- `PROJECT.md`;
- `AGENTS.md`;
- GitHub Issues;
- `ROADMAP.md` or `TODO.md` through `dnb-project-task-triage`.

Commits should be topic-coherent and reference related issues with `closes #123`, `see #123`, or similar wording.
