---
id: dnb-post-session-into-void
name: dnb-post-session-into-void
title: DNB Post Session Into Void
description: Draft and publish a confirmed Mastodon post from the current AI session context using @humanwhocodes/crosspost.
---

Use this skill when the user wants to turn the current AI session context into a Mastodon post and publish it only after explicit confirmation.

Typical trigger phrases:

- `/dnb-post-session-into-void write about this on mastodon`
- `write about this on Mastodon`
- `post this to Mastodon`
- `turn this into a social post`
- `make a Mastodon post from this`

## Core workflow

1. Read the current conversation context.
2. Ask the user for any missing context needed to write accurately.
3. Ask whether an image should be included.
4. Ask for image path or attached image details if an image is required.
5. Draft one Mastodon post, or two to three alternatives if useful.
6. Keep each draft within the configured character range.
7. Ask for explicit confirmation before publishing.
8. Only after confirmation, call the TypeScript resource script.
9. Return the link to the newly created Mastodon post.

Never publish without explicit user confirmation.

## Assumptions

The CLI session already has the required environment variables available.

The user stores environment variables in:

```text
~/.env
```

The resource script also sets:

```text
CROSSPOST_DOTENV=~/.env
```

when it is not already defined, so `@humanwhocodes/crosspost` can load the same file directly.

Expected Mastodon variables for Crosspost include at least:

```text
MASTODON_ACCESS_TOKEN
MASTODON_HOST
```

## Drafting rules

Default post length:

```text
min: 300 characters
max: 500 characters
```

The limits are configurable. If the user gives a different range, use that range.

The post should:

- be clear, concrete, and grounded in the session context
- avoid hype, vague claims, and engagement bait
- avoid hashtags unless they are genuinely useful
- avoid unsupported claims
- avoid mentioning private implementation details unless the user wants them public
- avoid implying work is finished if the session only explored or planned it
- preserve the user's preferred tone when known
- use British English unless the user requests otherwise

If the source context is thin, ask one concise context question before drafting.

If the context is sufficient, draft without asking for extra context.

## Image handling

Always ask whether the user wants to include an image.

If yes, request:

- local image path
- image alt text

Do not invent alt text for a real image unless the user asks for help writing it.

If the user provides an attached image but no local path is available to the CLI, explain that the publishing script needs a local file path. Ask the user to save the image locally and provide the path.

If the user says no image, publish text-only.

## Confirmation protocol

After drafting, ask the user to confirm one of these actions:

- `post` / `publish` / `send it`
- `post option 1`
- `post option 2`
- `revise ...`
- `cancel`

Only confirmation that clearly requests publishing may trigger the resource script.

Before publishing, restate the exact final post text and image details, if any.

## Publishing command

Use the TypeScript resource script:

```bash
tsx skills/dnb-post-session-into-void/resources/post-mastodon.ts \
  --message-file /path/to/message.txt
```

With image:

```bash
tsx skills/dnb-post-session-into-void/resources/post-mastodon.ts \
  --message-file /path/to/message.txt \
  --image /path/to/image.jpg \
  --image-alt "Concise image description"
```

With custom limits:

```bash
tsx skills/dnb-post-session-into-void/resources/post-mastodon.ts \
  --message-file /path/to/message.txt \
  --min-chars 300 \
  --max-chars 500
```

## Output after publishing

Return:

```text
Published: <URL>
```

If the script cannot find a URL in the Crosspost output, return the raw Crosspost output and clearly state that no URL could be extracted.

## Safety and quality checks

Before posting, verify:

- the post is within the configured character range
- the post does not expose secrets, private paths, tokens, unpublished credentials, or private client details
- the post does not imply endorsement by a third party
- the image path exists if provided
- image alt text is present if an image is provided
- the user explicitly confirmed publishing

If any check fails, do not publish. Ask for correction or provide a revised draft.
