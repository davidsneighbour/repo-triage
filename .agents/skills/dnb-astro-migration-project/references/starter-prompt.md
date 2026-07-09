# Starter Prompt

Use this prompt when the user wants a copyable prompt rather than a skill-created project bootstrap.

```text
Migrate this repository to Astro using a documentation-led, issue-backed process.

First, inspect the repository and identify the current site system. Determine whether the source of truth for parity is the source files, generated output such as public/dist/_site, a live site, or a combination. Triage routes, assets, styles, scripts, forms, redirects, metadata, widgets, deployment files, and CMS/admin/editor paths.

Create or update AGENTS.md, PROJECT.md, README.md, MIGRATION.md, MIGRATION.status.md, ROADMAP.md, and TODO.md. Make MIGRATION.md the operating instructions, MIGRATION.status.md the route/system tracker, GitHub Issues the source of truth for actionable work, ROADMAP.md the generated project index, and TODO.md the scratchpad inbox.

Use a migration branch whose name starts with migration unless I explicitly say otherwise. Preserve user changes. Do not begin implementation work until there are GitHub Issues for the intended work. Use milestones for Inventory, Astro Foundation, Content Parity, Visual Parity, Cleanup, and Post-Parity Improvements.

The first migration milestone is parity with the current public website: visible design, behavior, content, metadata, URLs, assets, forms, redirects, downloads, widgets, and deployment behavior. Keep everything needed for parity. Remove or redirect only when evidence shows a route or file is obsolete, generated cruft, admin/editor/CMS UI, stale backup material, or an implementation detail not meant for the public site. Defer improvements such as redesign, accessibility upgrades, SEO rewrites, performance refactors, new form backends, and asset pipeline optimization into post-parity issues.

Ask only one blocking clarification question at a time. After I answer, record the decision in MIGRATION.md, MIGRATION.status.md, PROJECT.md, or a GitHub Issue before continuing.

Before finishing any task, review whether MIGRATION.md, MIGRATION.status.md, PROJECT.md, ROADMAP.md, TODO.md, AGENTS.md, README.md, or GitHub Issues need updates. Commits should be topic-coherent and reference issue numbers.
```
