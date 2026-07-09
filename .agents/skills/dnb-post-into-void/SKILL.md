---
id: dnb-post-into-void
name: dnb-post-into-void
title: DNB Post Into Void
description: Prepare and publish a casual Mastodon post from text supplied with the request or collected through questions, without using the current AI session as source material. Use for `/dnb-post-into-void`, short status updates, spontaneous thoughts, and other posts that may need optional rewriting, hashtags, or an image before explicit publishing confirmation.
---

Prepare a casual Mastodon post from information the user supplies specifically for
this post. Publish it through `@humanwhocodes/crosspost` only after explicit
confirmation.

## Context boundary

Treat the text following the skill command and the user's answers to the skill's
questions as the only source material.

Do not:

- use, summarise, or infer content from the conversation before the skill was invoked
- turn the current AI session, recent work, or earlier discussion into the post
- add facts, opinions, names, or context that the user did not provide for this post

Use earlier conversation context only if the user explicitly asks to import a
specific piece of it into the post. Otherwise, ignore it even when it appears
relevant.

## Conversation flow

Ask the questions one at a time. Skip only questions the user has already answered.

1. If no post text or topic followed the command, ask: `What do you want to post?`
2. After receiving source text, ask: `Do you want me to optimise or rewrite it?`
3. If the answer is no, preserve the supplied wording exactly. Do not silently fix
   spelling, punctuation, tone, or style.
4. If the answer is yes, produce a concise rewrite that preserves the meaning and
   voice. Ask a follow-up question only when a missing choice would materially
   change the result.
5. Ask: `Do you want to add hashtags?`
6. If the answer is yes, suggest a small, relevant hashtag set. Show the resulting
   post and let the user accept, remove, replace, or edit the hashtags.
7. Ask whether the user wants to include an image.
8. If yes, collect the local image path and alt text.
9. Present the exact final post, image details when applicable, and character count.
10. Ask for explicit confirmation to publish.
11. Publish only after clear confirmation, then return the resulting Mastodon URL.

Do not repeatedly ask whether to optimise after the user has answered. Revisions
requested later apply directly to the current draft.

## Example interaction

User:

```text
/dnb-post-into-void What a wonderful day again...
```

Assistant:

```text
Do you want me to optimise or rewrite it?
```

If the user says no, retain `What a wonderful day again...` unchanged, then ask
whether to add hashtags. If the user says yes, suggest relevant options such as:

```text
#WonderfulDay #GoodDay
```

Do not add the suggestions until the user accepts or edits them.

## Drafting rules

Use this default character range:

```text
min: 1 character
max: 500 characters
```

Use a different range when the user requests one.

When rewriting, make the post:

- clear and natural
- faithful to the supplied meaning
- free of hype, engagement bait, and unsupported claims
- suitable for a casual Mastodon post
- written in British English unless the user requests otherwise

When rewriting is declined, the user's wording takes priority over these style
preferences. Only block or query content when publishing it would expose secrets,
credentials, private client details, or other clearly sensitive information.

Keep hashtags restrained and specific. Prefer two to four useful hashtags over a
large generic list. Do not add hashtags without asking.

## Image handling

When the user wants an image, request:

- the local image path
- image alt text

Do not invent alt text for a real image unless the user asks for help writing it.

If an attached image has no local path available to the CLI, explain that the
publishing script requires a local file path and ask the user to provide one.

## Confirmation protocol

Accept clear publishing instructions such as:

- `post`
- `publish`
- `send it`
- `post this version`

Treat requests to revise, change hashtags, change the image, or cancel as not being
publishing confirmation.

Immediately before publishing, restate the exact post and image details. Never
publish without explicit confirmation.

## Publishing

The CLI session is expected to expose:

```text
MASTODON_ACCESS_TOKEN
MASTODON_HOST
```

The resource script defaults `CROSSPOST_DOTENV` to `~/.env` when the variable is not
already set.

Publish text with:

```bash
tsx skills/dnb-post-into-void/resources/post-mastodon.ts \
  --message-file /path/to/message.txt
```

Publish with an image:

```bash
tsx skills/dnb-post-into-void/resources/post-mastodon.ts \
  --message-file /path/to/message.txt \
  --image /path/to/image.jpg \
  --image-alt "Concise image description"
```

Pass `--min-chars` or `--max-chars` when the user requests custom limits.

## Final checks

Before publishing, verify:

- the final post matches the version the user approved
- the post is within the configured character range
- no secrets, tokens, credentials, private paths, or private client details are
  exposed
- the image exists and has alt text when an image is included
- the user explicitly confirmed publishing

If a check fails, do not publish. Explain the issue and ask for the smallest needed
correction.

After successful publishing, return:

```text
Published: <URL>
```

If no URL can be extracted, return the raw Crosspost output and state that no URL
was found.
