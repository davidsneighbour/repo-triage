---
id: dnb-reference
name: dnb-reference
title: Add AI File Reference
type: skill
description: Add or update a strict references front matter entry on an AI asset file from a supplied HTTP or HTTPS URL. Use when the user provides a URL and a prompt, skill, instruction, workflow, template, or doc file that should cite that resource in YAML front matter.
inputs:
  url:
    required: true
    type: string
    description: HTTP or HTTPS URL to add as a reference.
  ai_file:
    required: true
    type: string
    description: Path to the AI Markdown file that should receive the reference.
---

## Add AI File Reference

Add one external source to an AI asset file by editing its YAML front matter.

### Required Input

Require both:

- `url`: an absolute URL beginning with `http://` or `https://`
- `ai_file`: a Markdown file in a managed AI asset directory, such as `prompts/`, `instructions/`, or `documentation/`

If either value is missing, ask for the missing value before editing.

### Workflow

1. Confirm the target file exists and is an AI Markdown file.
2. Confirm the file starts with YAML front matter.
3. Validate that the URL begins with `http://` or `https://`.
4. Inspect the resource enough to derive a concise `name` and `note`:

   - Prefer the page title for `name`.
   - Use a one-sentence summary for `note`.
   - If the resource cannot be fetched, use the URL host or obvious page title for `name` and omit `note`.

5. Read the current front matter and preserve all existing fields.
6. Add or update exactly one item under `references`.

### Reference Shape

Use this exact structure:

```yaml
references:
- name: Resource title
  src: https://example.com/resource
  note: One concise sentence describing why this resource is relevant.
```

Rules:

- `references` is optional, but when present it must contain one or more items.
- Each item must include `src`.
- Each item may include only `name`, `src`, and `note`.
- Do not add any other keys to `references` items.
- Do not add duplicate entries with the same `src`.
- If an entry for the same `src` already exists, update only missing or stale `name` and `note` fields.

### Editing Rules

Preserve the existing front matter order as much as practical.

When adding a new `references` property, place it near the end of the front matter, before the closing `---`.

Keep `note` short, plain, and factual. Do not include marketing language, long excerpts, or claims that were not visible in the resource.

After editing, validate the file with the repository schema or the closest available validation command.
