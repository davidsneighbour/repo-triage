---
id: dnb-blog-draft-meta-matter
name: dnb-blog-draft-meta-matter
title: Prepare Blog Draft Metadata
type: skill
description: Prepare SEO-aware titles, slugs, descriptions, and summaries from a blog draft or topic, then return comparable metadata options.
version: 0.2.0
tags:
  - blog
  - metadata
  - seo
  - writing
inputs:
  - draft
  - topic
  - config.toml
---

Use this skill to prepare reusable blog metadata from either a supplied draft or a topic idea.

The output must help choose a final title, slug, description, and summary before the draft is saved.

## Configuration

Before producing final paths, inspect the current repository for:

```text
config.toml
```

and read:

```toml
[dnb.publishing]
```

If `config.toml` or `[dnb.publishing]` is missing:

- mention that publishing configuration is missing
- refer the user to the `README.md` located next to this `SKILL.md`
- continue with title, slug, description, and summary suggestions
- set the `Path` field to `Not available until [dnb.publishing] is configured`
- do not invent repository-specific paths

Expected minimum config:

```toml
[dnb.publishing]
content_root = "src/content/blog"
path_pattern = "{year}/{slug}/index.md"
url_pattern = "/blog/{year}/{slug}/"
date_format = "yyyy-MM-dd"
default_draft = true
frontmatter_fields = ["title", "date", "description", "summary", "draft"]
```

Build the path from:

```text
{content_root}/{path_pattern}
```

Supported placeholders:

```text
{year}
{slug}
```

Use the current date to derive `{year}`, unless the user specifies another date.

## Input handling

If a draft is provided, infer the topic, angle, search intent, and technical keywords from the draft.

If no draft is provided, ask for either:

1. the draft text, or
2. a topic, working title, and intended audience.

## 1. Title exploration

Create up to 5 title options.

Each title must be checked for:

- accurately expressing what the article explains
- sounding natural as a blog post title
- including searchable keywords where useful
- using "How to" when it improves clarity or search intent
- optionally using a question when the article solves a common problem
- avoiding vague, clever, or clickbait phrasing
- matching the article's actual depth and promise

Prefer titles that make the reader understand the practical result of the post.

## 2. Slug exploration

Create one slug for each title option.

The slug must:

- be based on the title
- be readable and understandable
- include important keywords
- be short enough for a clean URL
- use lowercase letters
- use dashes instead of spaces
- avoid special characters
- avoid filler words when they do not help meaning
- fit into the configured final path

Prefer slugs between 35 and 70 characters unless clarity requires otherwise.

Keep the slug below 120 characters.

## 3. Description exploration

Create one description for each title and slug option.

Each description must:

- be between 140 and 160 characters
- summarise what the post covers
- include relevant keywords naturally
- be suitable for search result snippets
- avoid exaggerated claims
- avoid keyword stuffing
- avoid repeating the title too mechanically

Always include the character count.

Do not forcibly create multiple descriptions if the current one is already optimal for the title and slug sequence. Reuse it in that case.

## 4. Summary exploration

Create one summary for each title and slug option.

The summary is used in blog listing previews.

Each summary must:

- be longer and more introductory than the description
- be under 360 characters
- not be short only to save space
- use the available length where useful
- explain what the post is about
- mention the practical context
- avoid giving away every detail
- avoid hard selling
- make the topic clear enough for the reader to decide whether to open the post

Prefer 2 to 4 concise sentences.

Do not forcibly create multiple summaries if the current one is already optimal for the title, slug, and description sequence. Reuse it in that case.

## Output format

Return one Markdown subsection per option.

Use this structure:

```text
### Option N: TITLE

| Field | Value |
| ----- | ----- |
| Title | TITLE |
| Slug | `slug-value` |
| Path | `content_root/YYYY/slug-value/index.md` |
| Description | Description text. (000 characters) |
| Summary | Summary text. (000 characters) |
```

After all options, add:

```text
Recommended option: N
Reason: ...
```

The recommendation should prioritise clarity, search intent, URL quality, and how well the metadata matches the actual draft.

Do not use a wide comparison table for the final output. Prefer vertical option tables so the result remains readable on narrow screens.
