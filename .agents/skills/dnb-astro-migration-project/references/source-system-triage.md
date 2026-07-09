# Source System Triage

Use this reference before creating the Astro plan. The goal is to identify the current system, the true source of the public website, and which parts must survive the migration.

## Identify The Current System

Inspect, when present:

- `package.json`, lockfiles, framework config, and scripts;
- `astro.config.*`, `next.config.*`, `nuxt.config.*`, `gatsby-config.*`, `eleventy.config.*`, `vite.config.*`;
- Hugo files such as `hugo.toml`, `config.toml`, `go.mod`, `layouts/`, `content/`, `archetypes/`, `data/`, `i18n/`, and `static/`;
- Jekyll files such as `_config.yml`, `_layouts/`, `_includes/`, `_posts/`, and `Gemfile`;
- CMS config such as `admin/config.yml`, Forestry, Tina, Decap, Front Matter CMS, Sanity, Contentful, or Strapi files;
- deployment config such as `netlify.toml`, Vercel files, redirects, functions, edge functions, and environment notes;
- generated output directories such as `public/`, `dist/`, `_site/`, `build/`, and backup directories.

Classify the source system as one or more of:

- static HTML output;
- legacy static-site generator;
- Hugo;
- Jekyll;
- Eleventy;
- Gatsby;
- Next/Nuxt/SvelteKit static export;
- CMS-backed static site;
- custom build pipeline;
- unknown or mixed.

## Decide The Source Of Truth

Choose the source of truth with evidence:

- Prefer maintained source content/templates when they reliably produce the live site.
- Prefer generated `public/` or live-site crawl when the source build is stale, broken, or incomplete.
- Preserve a backup of whichever artifact is the accepted source of truth before replacing it.
- Treat old backups as reference-only unless the user asks to inspect them.

Ask one blocking question if source truth is ambiguous, for example: "Should I treat `public/` or the Hugo source files as the source of truth for parity?"

## Inventory What Exists

Inventory:

- local HTML routes and canonical URLs;
- feeds, sitemaps, robots, favicons, manifests, and error pages;
- redirects and removed paths;
- images, video, fonts, PDFs, downloads, and other static assets;
- CSS and design system files;
- JavaScript, widgets, embeds, maps, analytics, and third-party scripts;
- forms, form actions, thank-you pages, spam protection, and email behavior;
- metadata, Open Graph, structured data, language tags, and canonical links;
- deployment expectations and quality gates.

## Keep

Keep public behavior needed for parity:

- all public routes not explicitly removed;
- page content and media;
- metadata and SEO-critical fields;
- form flows and thank-you routes;
- public downloads;
- scripts required for visible behavior;
- redirects, 404 behavior, robots, favicons, and deployment config;
- widget/embed routes known to be consumed externally.

## Remove Or Redirect

Remove only with evidence or explicit user acceptance:

- admin/editor/CMS routes that should not remain public;
- generated taxonomy pages with no user value;
- stale backup directories;
- old build caches and dependency directories;
- unused theme/example/demo files;
- source files for a retired generator once parity is accepted and cleanup issues are active.

For public URLs, prefer redirects over silent removal. Track intentional removals in `MIGRATION.status.md` and GitHub Issues.

## Defer

Defer improvements that expand scope beyond parity:

- redesigns;
- content rewrites;
- accessibility/SEO upgrades not needed to preserve existing behavior;
- performance refactors;
- replacing third-party services;
- new form backends;
- asset pipeline optimization;
- broad dependency modernization.

Create post-parity GitHub Issues for these ideas.
