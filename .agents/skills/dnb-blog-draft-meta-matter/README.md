# DNB blog draft publishing skills

This README belongs next to these skills:

```text
dnb-blog-draft-meta-matter/SKILL.md
dnb-blog-draft-materialise/SKILL.md
````

The same README can be copied into both skill directories.

## Purpose

The blog draft workflow uses two separate skills.

```text
dnb-blog-draft-meta-matter
```

prepares SEO-aware metadata options:

```text
title
slug
description
summary
path
```

```text
dnb-blog-draft-materialise
```

takes the selected option and creates or moves the draft into the configured blog content location.

The workflow is intentionally split:

```text
draft -> metadata options -> user selects option -> file is created or moved
```

This keeps metadata generation separate from file-system changes.

## Required repository configuration

Each repository that wants to use these skills must define publishing settings in the repository root:

```text
config.toml
```

with this section:

```toml
[dnb.publishing]
content_root = "src/content/blog"
path_pattern = "{year}/{slug}/index.md"
url_pattern = "/blog/{year}/{slug}/"
date_format = "yyyy-MM-dd"
default_draft = true
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

## Minimal example

For a site that stores blog posts at:

```text
src/content/blog/2026/example-post/index.md
```

use:

```toml
[dnb.publishing]
content_root = "src/content/blog"
path_pattern = "{year}/{slug}/index.md"
url_pattern = "/blog/{year}/{slug}/"
date_format = "yyyy-MM-dd"
default_draft = true
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

## Configuration fields

### `content_root`

The root directory for blog content.

Example:

```toml
content_root = "src/content/blog"
```

The materialise skill resolves this relative to the VS Code workspace root.

### `path_pattern`

The path pattern inside `content_root`.

Example:

```toml
path_pattern = "{year}/{slug}/index.md"
```

Supported placeholders:

```text
{year}
{slug}
```

The final path is built as:

```text
{content_root}/{path_pattern}
```

Example:

```text
src/content/blog/2026/how-to-debug-gitignore-rules/index.md
```

### `url_pattern`

The public URL pattern for the post.

Example:

```toml
url_pattern = "/blog/{year}/{slug}/"
```

Supported placeholders:

```text
{year}
{slug}
```

This is mainly useful for previewing the resulting URL. The materialise skill writes files based on `content_root` and `path_pattern`.

### `date_format`

The date format used in frontmatter.

Recommended:

```toml
date_format = "yyyy-MM-dd"
```

Example output:

```yaml
date: "2026-07-01"
```

### `default_draft`

Controls the default draft state.

Example:

```toml
default_draft = true
```

Output:

```yaml
draft: true
```

Set this to `false` only if new materialised posts should be published immediately.

### `frontmatter_fields`

Controls which frontmatter fields the materialise skill writes.

Recommended:

```toml
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

The materialise skill updates these fields if they already exist and preserves unrelated fields where possible.

## Example workflow in VS code

1. Open a Markdown blog draft.

2. Ask the assistant to run `dnb-blog-draft-meta-matter`.

3. Review the generated metadata options.

4. Reply with the selected option number, for example:

   ```text
   1
   ```

5. Ask the assistant to run `dnb-blog-draft-materialise`.

6. The assistant creates or moves the draft to the configured path.

Example final path:

```text
src/content/blog/2026/how-to-sync-claude-code-settings-dotfiles/index.md
```

Example frontmatter:

```yaml
---
title: "How to Sync Claude Code Settings in Dotfiles Without Tracking State"
date: "2026-07-01"
description: "Sync Claude Code settings with dotfiles while keeping runtime state, caches, history, logs, secrets, and agent memory out of Git repositories."
summary: "This post explains how to add a global .claude directory to a dotfiles repository without turning runtime state into source code. It separates authored configuration from caches, logs, transcripts, local state, and agent memory, then shows the decision gates behind a safe allow-list."
draft: true
---
```

## Behaviour when config is missing

If `config.toml` or `[dnb.publishing]` is missing:

- `dnb-blog-draft-meta-matter` may still suggest titles, slugs, descriptions, and summaries
- `dnb-blog-draft-meta-matter` must not invent final repository paths
- `dnb-blog-draft-materialise` must stop before writing files
- `dnb-blog-draft-materialise` must not guess a fallback path

Add the `[dnb.publishing]` section to `config.toml`, then run the skill again.

## Adapting another repository

For a repository that stores posts at:

```text
content/blog/2026/example-post/index.md
```

use:

```toml
[dnb.publishing]
content_root = "content/blog"
path_pattern = "{year}/{slug}/index.md"
url_pattern = "/blog/{year}/{slug}/"
date_format = "yyyy-MM-dd"
default_draft = true
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

For a repository that stores posts at:

```text
src/content/posts/example-post.md
```

use:

```toml
[dnb.publishing]
content_root = "src/content/posts"
path_pattern = "{slug}.md"
url_pattern = "/posts/{slug}/"
date_format = "yyyy-MM-dd"
default_draft = true
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

## Recommended commit pattern

When materialising a draft, commit both the created post and any related config changes.

Example:

```bash
git add -- config.toml src/content/blog
git commit --message "feat(blog): add draft about gitignore cleanup"
```

## Safety notes

The materialise skill should never overwrite an existing post silently.

If the target file already exists, choose one of:

```text
overwrite
rename
stop
```

For normal use, prefer `stop` unless the existing file is clearly the same draft.
