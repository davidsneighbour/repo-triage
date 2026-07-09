---
id: dnb-markdown-formatting
name: dnb-markdown-formatting
title: DNB Markdown Formatting
description: Decide whether strict CommonMark or GitHub Flavored Markdown (GFM) rules apply to a Markdown file, then apply the matching instruction set. Use when writing or reviewing Markdown and the target renderer is not obvious from the file name or path alone, or when a user names a specific Markdown flavor or target renderer.
---

A file's `.md` extension does not say which Markdown flavor applies. A
strict CommonMark parser, GitHub, a static site generator's own renderer
(Hugo/Goldmark, MDX, etc.), and an IDE preview can all disagree on whether
tables, task lists, strikethrough, or bare-URL autolinking are valid. This
skill decides which rule set to apply before writing or reviewing a Markdown
file, instead of guessing from the file extension.

## 1. Determine the target

Ask, or infer from context, what will render the file:

- **GitHub** (README, issue, PR body, this registry's own docs): GFM.
- **A static site generator or docs tool the user names** (Hugo, Jekyll,
  Docusaurus, MkDocs, etc.): check whether it documents itself as
  GFM-compatible; most are. If unsure, ask.
- **A test fixture, spec-compliance check, or a renderer the user explicitly
  says is CommonMark-only**: strict CommonMark, no extensions.
- **Unspecified, and no signal either way**: default to GFM. In practice
  almost everything that renders Markdown today, including GitHub, most
  static site generators, and IDE previews, is GFM-compatible or a superset
  of it, and GFM is a strict superset of CommonMark, so defaulting to it is
  the safer guess.

Only ask the user when the choice changes what is valid syntax for the task
at hand, for example when the draft would use a table, task list, or bare
autolink and a strict CommonMark target would reject it.

## 2. Apply the matching instructions

- Always apply `instructions/markdown-commonmark.instructions.md`. It is the
  base syntax every Markdown file must satisfy.
- When the target is GFM or GFM-compatible (the default), also apply
  `instructions/markdown-gfm.instructions.md`. It documents only the
  extensions GFM adds on top of CommonMark; it does not repeat the base
  rules.
- When the target is strict CommonMark, do not use GFM-only constructs
  (tables, task lists, strikethrough, bare autolinks) even if they would
  render correctly on GitHub.

## 3. Prefer the project's linter for style, not spec compliance

Spec files describe what is valid syntax and how ambiguous constructs
resolve; they are not a style guide. If the repository has a Markdown linter
configured (for example `markdownlint` with a `.markdownlint.jsonc` or
`.markdownlint.yml`), run it for house style, formatting, and accessibility
mechanics. Use the spec instructions to resolve genuine parsing questions the
linter cannot answer, such as whether a construct is valid at all, not to
re-derive style rules the linter already enforces.
