---
id: dnb-project-task-triage
name: dnb-project-task-triage
title: DNB Project Task Triage
description: "Maintains the repository task-tracking system by syncing TODO.md with GitHub Issues and regenerating ROADMAP.md. Use when asked to check project status, update task tracking, sync todos with GitHub, regenerate the roadmap, or recommend next steps. Triggers on: 'check status', 'project status', 'sync todos', 'update roadmap', 'triage tasks', 'what's next', 'next steps'."
---

Use this procedure when asked to check the status of a repository, update project tracking, sync TODO items with GitHub issues, regenerate the roadmap, or recommend next steps.

## Purpose

Maintain the repository task-tracking system.

This repository uses three tracking layers:

1. **GitHub Issues** are the source of truth.
   - Every actual task, bug, improvement, tracked decision, or follow-up that needs action belongs in the GitHub issue tracker.
   - Issues must include enough context, explanation, references, expected outcome, dependencies, and acceptance criteria to be actionable.
   - Issues may contain clarification questions when requirements are incomplete.
   - Once something is represented by a GitHub issue, it must not remain as a duplicate task in `/TODO.md`.

2. **`/ROADMAP.md`** is the generated project index.
   - It is a quick cache of the current GitHub issue state.
   - It must list every relevant open GitHub issue.
   - It may group issues by topic, priority, type, phase, or recommended execution order.
   - It should include short notes explaining the purpose, risk, dependency, or expected impact of each issue.
   - It should include a short project-state summary at the top.
   - It should include useful project health indicators where available, such as test coverage, failing checks, build status, lint status, documentation gaps, dependency status, or other measurable project-specific signals.
   - It may include a recommended next-steps section.
   - It must not be treated as the source of truth.
   - Do not copy full issue bodies into `/ROADMAP.md`; detailed explanations belong in GitHub Issues.

3. **`/TODO.md`** is the scratchpad/inbox.
   - It is used for rough notes, ideas, quick reminders, and unprocessed task candidates.
   - It may be handwritten, incomplete, duplicated, badly formatted, or partially obsolete.
   - It is not a task-tracking system.
   - Anything already represented by a GitHub issue must not remain in `/TODO.md`.
   - Only unclear, non-actionable, or intentionally unprocessed notes should remain in `/TODO.md`.

## Procedure

1. Read the current tracking state.
   - Read `/TODO.md`.
   - Read `/ROADMAP.md`.
   - Fetch current GitHub issues for the repository.
   - Include open issues.
   - Include recently closed issues only when needed to reconcile stale roadmap or TODO entries.
   - Treat GitHub Issues as authoritative whenever `/ROADMAP.md` or `/TODO.md` disagrees with the issue tracker.

2. Reconcile GitHub Issues with `/ROADMAP.md`.
   - Ensure every relevant open GitHub issue is listed in `/ROADMAP.md`.
   - Remove closed, completed, duplicate, or obsolete issues from `/ROADMAP.md`.
   - If an issue appears in `/ROADMAP.md` but no longer exists or is closed, remove it from `/ROADMAP.md`.
   - If an issue is open in GitHub but missing from `/ROADMAP.md`, add it.
   - If work is clearly complete but the GitHub issue is still open, close the issue with a short explanation.
   - Do not close issues when completion is uncertain. Add a note or clarification question instead.

3. Reconcile `/TODO.md` with GitHub Issues.
   - Review every item in `/TODO.md`.
   - Remove every TODO item that is already covered by an existing GitHub issue.
   - Do not keep duplicate task descriptions in `/TODO.md` once they exist in GitHub.
   - If a TODO item is related to an existing issue, add useful missing context to that issue instead of creating a duplicate issue.
   - If a TODO item is too unclear to convert into an issue, leave it in `/TODO.md` and mark what clarification is needed.
   - If a TODO item is only a note, idea, or reminder and is not ready for tracking, keep it in `/TODO.md`.

4. Process new TODO items.
   - Split rough notes into individual actionable items.
   - Create one GitHub issue per new actionable item.
   - Do not combine unrelated tasks into one issue.
   - Do not create issues for vague notes unless there is enough context to make the issue useful.
   - Each new issue must include:
     - context
     - problem or goal
     - expected outcome
     - relevant references
     - acceptance criteria
     - known dependencies
     - clarification questions where requirements are unclear

   - Do not guess missing requirements. Ask clarification questions inside the issue.

5. Update existing GitHub issues where useful.
   - Add missing context from `/TODO.md` or `/ROADMAP.md`.
   - Add references to relevant files, commands, failing checks, previous decisions, or related issues.
   - Add clarification questions when the issue cannot be implemented safely from the available information.
   - Avoid noisy updates. Only update an issue when the added information improves actionability.

6. Collect project health indicators.
   - Use existing project scripts where available.
   - Prefer lightweight checks over expensive full audits unless explicitly requested.
   - Useful indicators may include:
     - test status
     - coverage current vs threshold
     - lint status
     - typecheck status
     - build status
     - CI status
     - dependency status
     - documentation gaps

   - Do not invent measurements.
   - If a measurement cannot be collected, omit it or clearly mark it as unavailable.

7. Regenerate `/ROADMAP.md`.
   - Rebuild `/ROADMAP.md` from the current GitHub issue state.
   - Start with a short project-state summary.
   - Group open issues into useful sections, such as bugs, fixes, refactoring, performance, documentation, new features, maintenance, or follow-up work.
   - For each issue, include:
     - issue number
     - issue title
     - issue link
     - short notes explaining why it matters, what is blocked, what needs attention, or what the likely implementation path is

   - Add dependency notes where one issue should happen before another.
   - Add a suggested order of work.
   - Add a section for open clarification questions.
   - Add project health indicators where available and relevant.
   - Keep `/ROADMAP.md` concise enough to scan quickly.
   - Keep detailed explanations in GitHub Issues, not in `/ROADMAP.md`.

8. Clean `/TODO.md`.
   - Remove items converted into GitHub issues.
   - Remove items already covered by existing GitHub issues.
   - Remove duplicate or obsolete notes.
   - Keep only notes that are unclear, non-actionable, intentionally not ready for issue creation, or useful as scratchpad material.
   - Add short clarification markers for remaining unclear notes where helpful.

9. Commit project tracking file changes.
   - At the end of the procedure, check the Git working tree for `/ROADMAP.md` and `/TODO.md`.
   - Commit any pending changes to those two files, including changes made during this run and pre-existing uncommitted changes.
   - Commit only `/ROADMAP.md` and `/TODO.md`.
   - Do not include source-code changes, generated files, dependency files, or unrelated edits.
   - If neither `/ROADMAP.md` nor `/TODO.md` has pending changes in the Git working tree, do not create a commit.
   - Use this commit subject exactly:
     `chore(project): update project plan`
   - Add a commit body summarising the current project-plan update, including any relevant:
     - issues created
     - issues closed
     - existing issues updated
     - TODO items moved into GitHub Issues
     - TODO items left behind
     - project health indicators updated in `/ROADMAP.md`

10. Report the result.
    - List issues closed.
    - List issues created.
    - List existing issues updated.
    - List items removed from `/TODO.md` because they are now tracked in GitHub.
    - List duplicates skipped.
    - List TODO items left behind and why.
    - List project health indicators added or updated in `/ROADMAP.md`.
    - End with the same recommended next steps that were written into `/ROADMAP.md`.

## Boundaries

Only update:

- GitHub Issues
- `/ROADMAP.md`
- `/TODO.md`

Do not implement source-code changes unless explicitly asked.

Do not delete human notes from `/TODO.md` unless they are obsolete, duplicated, or represented by a GitHub issue.

Do not close GitHub issues unless completion is clear from the repository state, issue discussion, or existing project files.

Only commit `/ROADMAP.md` and `/TODO.md`. Never include unrelated file changes in the project-plan commit.
