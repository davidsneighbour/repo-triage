# Changelog

## [3.1.0](https://github.com/davidsneighbour/project-dashboard/compare/v3.0.3...v3.1.0) (2026-06-17)

### Features

* **board:** add Unchecked column for repos with no check history ([ec7d6b4](https://github.com/davidsneighbour/project-dashboard/commit/ec7d6b4c7a8d9216536e3141b5eca693cea36778))

### Miscellaneous

* cleanup workspace settings ([1ac72d8](https://github.com/davidsneighbour/project-dashboard/commit/1ac72d81df017ca29bcaa5c52bd2d23463252f6d))

## [3.0.3](https://github.com/davidsneighbour/project-dashboard/compare/v3.0.2...v3.0.3) (2026-06-15)

### Bug fixes

* **docker:** resolve gh token from host keyring via npm wrapper scripts ([3745452](https://github.com/davidsneighbour/project-dashboard/commit/3745452f04ca629c403ac8dda1f5a434da3c2c1b))

## [3.0.2](https://github.com/davidsneighbour/project-dashboard/compare/v3.0.1...v3.0.2) (2026-06-15)

### Bug fixes

* **docker:** install gh CLI and mount host config so auth token fallback works ([0e0ddd2](https://github.com/davidsneighbour/project-dashboard/commit/0e0ddd2d0df0c16c175a4ff9be6bad1d0e3077d5))

## [3.0.1](https://github.com/davidsneighbour/project-dashboard/compare/v3.0.0...v3.0.1) (2026-06-15)

### Bug fixes

* **docker:** add linux/arm64 to multi-platform build (Raspberry Pi support) ([d7acd9a](https://github.com/davidsneighbour/project-dashboard/commit/d7acd9ad16569b505cf5e086be915bd6316ca91d))

## [3.0.0](https://github.com/davidsneighbour/project-dashboard/compare/v1.0.0...v3.0.0) (2026-06-14)

### ⚠ BREAKING CHANGES

* remove deprecated GITHUB_USERNAME env var alias

### Features

* **cli:** fuzzy/multi resolve, open command, --all-matching bulk ops (closes [#13](https://github.com/davidsneighbour/project-dashboard/issues/13)) ([7249cd3](https://github.com/davidsneighbour/project-dashboard/commit/7249cd3b94df8a9a3d7129e258138171fda1bf33))
* **cli:** watch mode with OS notifications (issue [#31](https://github.com/davidsneighbour/project-dashboard/issues/31)) ([c3c95b2](https://github.com/davidsneighbour/project-dashboard/commit/c3c95b2315cf2b8f371081a5fcc8244d1147f001))
* cross-session undo history (issue [#29](https://github.com/davidsneighbour/project-dashboard/issues/29)) ([718acbf](https://github.com/davidsneighbour/project-dashboard/commit/718acbf0b745ccd4b7902072fba8cbac8ccf4a64))
* **docker:** publish image to GHCR on release tags ([db121ce](https://github.com/davidsneighbour/project-dashboard/commit/db121cecedf75c99ade79500c681b9ae98d6713f))
* **e2e:** mobile viewport smoke tests for responsive layout (issue [#19](https://github.com/davidsneighbour/project-dashboard/issues/19)) ([5b19ed5](https://github.com/davidsneighbour/project-dashboard/commit/5b19ed56d9f2b142631150c10b25231796de0087))
* **gh-actions:** per-card gh quick actions — open, list PRs, create issue ([6b7e250](https://github.com/davidsneighbour/project-dashboard/commit/6b7e2500dda25d15f842b7ac91aeacef1f7bb8a3))
* **github:** add PAGINATE_VIA_GH mode via gh api --paginate ([9387054](https://github.com/davidsneighbour/project-dashboard/commit/93870549e018626cacc937ee8a7d7bd64c5cbfb5))
* implement one-off snooze (issue [#17](https://github.com/davidsneighbour/project-dashboard/issues/17), closes [#18](https://github.com/davidsneighbour/project-dashboard/issues/18)) ([5889269](https://github.com/davidsneighbour/project-dashboard/commit/58892698df5b96f1e289a8c7b44528474117c19f))
* per-repo activity log / review timeline (issue [#28](https://github.com/davidsneighbour/project-dashboard/issues/28)) ([4918dfb](https://github.com/davidsneighbour/project-dashboard/commit/4918dfb09561c4a396ecc814f4904ded2697f140))
* **perf:** 30-second client poll + payload cache with dirty-flag invalidation (issues [#26](https://github.com/davidsneighbour/project-dashboard/issues/26), [#24](https://github.com/davidsneighbour/project-dashboard/issues/24)) ([c6fa3c5](https://github.com/davidsneighbour/project-dashboard/commit/c6fa3c5b7a68af1765684b02ace315c9d31801fe))
* **perf:** make paginateViaGh async with spawn to unblock event loop (issue [#23](https://github.com/davidsneighbour/project-dashboard/issues/23)) ([fd3e8c8](https://github.com/davidsneighbour/project-dashboard/commit/fd3e8c80740bedc3dd4a5c5aa35e4447b1f45e74))
* **perf:** run ENRICH_METADATA enrichment async after initial payload (issue [#25](https://github.com/davidsneighbour/project-dashboard/issues/25)) ([2ad548c](https://github.com/davidsneighbour/project-dashboard/commit/2ad548c9a116f49a835bd16ad4933b59fcfd6ead))
* **prefs:** persist view/display prefs server-side via GET/PUT /api/prefs ([7727f0f](https://github.com/davidsneighbour/project-dashboard/commit/7727f0f9c4b17f94ca4f06ed863f92c7a566c6b3))
* remove deprecated GITHUB_USERNAME env var alias ([77f7bfc](https://github.com/davidsneighbour/project-dashboard/commit/77f7bfca5ccd2df0c1da6328851da9fe886e6771)), closes [#16](https://github.com/davidsneighbour/project-dashboard/issues/16)
* scheduled report export (issue [#32](https://github.com/davidsneighbour/project-dashboard/issues/32)) ([2f28181](https://github.com/davidsneighbour/project-dashboard/commit/2f2818102a4470f7b38c4cd1da39b0b820175cef))
* **settings:** in-app settings panel for review cycle, sync interval, owners ([b330b02](https://github.com/davidsneighbour/project-dashboard/commit/b330b024f25ce2fba5599a80ccab5d9478bb81b5))
* tag-based review rules (tag → inactivity_days override) (issue [#30](https://github.com/davidsneighbour/project-dashboard/issues/30)) ([1d18dcc](https://github.com/davidsneighbour/project-dashboard/commit/1d18dcc92a2e7a080bf56ecc3a006df25feb3c08))
* webhook receiver for real-time GitHub sync (issue [#27](https://github.com/davidsneighbour/project-dashboard/issues/27)) ([410aed5](https://github.com/davidsneighbour/project-dashboard/commit/410aed54da5ca69d8fd259f5b3dc321c83097b00))

### Bug fixes

* **CardMenu:** cap desktop menu height to prevent overflow past viewport ([2641103](https://github.com/davidsneighbour/project-dashboard/commit/2641103c6684caf6a4981afa66af705a0293c5b6))
* **ci:** resolve E2E viewport overflow, markdown lint, and bump Node to 26 ([65d8fdc](https://github.com/davidsneighbour/project-dashboard/commit/65d8fdcb38623c7d83422a6580134c141e85c127))
* **docker:** fix docker compose up — USER root, drop apk build tools, fix CMD ([3acda5f](https://github.com/davidsneighbour/project-dashboard/commit/3acda5f8062be8977d25616794983346bbed329d))
* **e2e:** align DEFAULT_INACTIVITY mock from 3 → 7 to match server default (issue [#33](https://github.com/davidsneighbour/project-dashboard/issues/33)) ([cf800a8](https://github.com/davidsneighbour/project-dashboard/commit/cf800a85c66a22a8b2eec3150eb784d626ef16c0))

### Refactoring

* **server:** split index.js into focused modules (issue [#22](https://github.com/davidsneighbour/project-dashboard/issues/22)) ([6211ff4](https://github.com/davidsneighbour/project-dashboard/commit/6211ff4147e2e6440b3466ab91407a0e4e0aa475))

### Documentation

* add ROADMAP.md with post-audit issues and suggested work order ([f9e93de](https://github.com/davidsneighbour/project-dashboard/commit/f9e93de9211f01081da71d6edac4890db02ca67a)), closes [#33](https://github.com/davidsneighbour/project-dashboard/issues/33)

### Tests

* **coverage:** fix threshold failures across client and server (issue [#21](https://github.com/davidsneighbour/project-dashboard/issues/21)) ([a9e9365](https://github.com/davidsneighbour/project-dashboard/commit/a9e93657b0e1ddd5dd8ba165e381b15f7a0a0fce))

### Build system

* **deps:** Bump playwright and @playwright/test in /e2e ([#20](https://github.com/davidsneighbour/project-dashboard/issues/20)) ([2458dc0](https://github.com/davidsneighbour/project-dashboard/commit/2458dc04f265bfafde8b2a561b3afaaa8b8adbd3))
* **docker:** bump base image to node:26-bookworm-slim ([4b02c51](https://github.com/davidsneighbour/project-dashboard/commit/4b02c5139b3984f0f94f28c241692afb30740485))
* **docker:** switch to cgr.dev/chainguard/node to eliminate CVEs ([79532f2](https://github.com/davidsneighbour/project-dashboard/commit/79532f2a738d108b7a975db1130f96770eab7f80))

### Miscellaneous

* **release:** v2.0.0 ([2ece26e](https://github.com/davidsneighbour/project-dashboard/commit/2ece26e819d605e1b4587a3610cda29145fc8123))

## [2.0.0](https://github.com/davidsneighbour/project-dashboard/compare/v1.0.0...v2.0.0) (2026-06-14)

### ⚠ BREAKING CHANGES

* remove deprecated GITHUB_USERNAME env var alias

### Features

* **cli:** fuzzy/multi resolve, open command, --all-matching bulk ops (closes [#13](https://github.com/davidsneighbour/project-dashboard/issues/13)) ([7249cd3](https://github.com/davidsneighbour/project-dashboard/commit/7249cd3b94df8a9a3d7129e258138171fda1bf33))
* **cli:** watch mode with OS notifications (issue [#31](https://github.com/davidsneighbour/project-dashboard/issues/31)) ([c3c95b2](https://github.com/davidsneighbour/project-dashboard/commit/c3c95b2315cf2b8f371081a5fcc8244d1147f001))
* cross-session undo history (issue [#29](https://github.com/davidsneighbour/project-dashboard/issues/29)) ([718acbf](https://github.com/davidsneighbour/project-dashboard/commit/718acbf0b745ccd4b7902072fba8cbac8ccf4a64))
* **docker:** publish image to GHCR on release tags ([db121ce](https://github.com/davidsneighbour/project-dashboard/commit/db121cecedf75c99ade79500c681b9ae98d6713f))
* **e2e:** mobile viewport smoke tests for responsive layout (issue [#19](https://github.com/davidsneighbour/project-dashboard/issues/19)) ([5b19ed5](https://github.com/davidsneighbour/project-dashboard/commit/5b19ed56d9f2b142631150c10b25231796de0087))
* **gh-actions:** per-card gh quick actions — open, list PRs, create issue ([6b7e250](https://github.com/davidsneighbour/project-dashboard/commit/6b7e2500dda25d15f842b7ac91aeacef1f7bb8a3))
* **github:** add PAGINATE_VIA_GH mode via gh api --paginate ([9387054](https://github.com/davidsneighbour/project-dashboard/commit/93870549e018626cacc937ee8a7d7bd64c5cbfb5))
* implement one-off snooze (issue [#17](https://github.com/davidsneighbour/project-dashboard/issues/17), closes [#18](https://github.com/davidsneighbour/project-dashboard/issues/18)) ([5889269](https://github.com/davidsneighbour/project-dashboard/commit/58892698df5b96f1e289a8c7b44528474117c19f))
* per-repo activity log / review timeline (issue [#28](https://github.com/davidsneighbour/project-dashboard/issues/28)) ([4918dfb](https://github.com/davidsneighbour/project-dashboard/commit/4918dfb09561c4a396ecc814f4904ded2697f140))
* **perf:** 30-second client poll + payload cache with dirty-flag invalidation (issues [#26](https://github.com/davidsneighbour/project-dashboard/issues/26), [#24](https://github.com/davidsneighbour/project-dashboard/issues/24)) ([c6fa3c5](https://github.com/davidsneighbour/project-dashboard/commit/c6fa3c5b7a68af1765684b02ace315c9d31801fe))
* **perf:** make paginateViaGh async with spawn to unblock event loop (issue [#23](https://github.com/davidsneighbour/project-dashboard/issues/23)) ([fd3e8c8](https://github.com/davidsneighbour/project-dashboard/commit/fd3e8c80740bedc3dd4a5c5aa35e4447b1f45e74))
* **perf:** run ENRICH_METADATA enrichment async after initial payload (issue [#25](https://github.com/davidsneighbour/project-dashboard/issues/25)) ([2ad548c](https://github.com/davidsneighbour/project-dashboard/commit/2ad548c9a116f49a835bd16ad4933b59fcfd6ead))
* **prefs:** persist view/display prefs server-side via GET/PUT /api/prefs ([7727f0f](https://github.com/davidsneighbour/project-dashboard/commit/7727f0f9c4b17f94ca4f06ed863f92c7a566c6b3))
* remove deprecated GITHUB_USERNAME env var alias ([77f7bfc](https://github.com/davidsneighbour/project-dashboard/commit/77f7bfca5ccd2df0c1da6328851da9fe886e6771)), closes [#16](https://github.com/davidsneighbour/project-dashboard/issues/16)
* scheduled report export (issue [#32](https://github.com/davidsneighbour/project-dashboard/issues/32)) ([2f28181](https://github.com/davidsneighbour/project-dashboard/commit/2f2818102a4470f7b38c4cd1da39b0b820175cef))
* **settings:** in-app settings panel for review cycle, sync interval, owners ([b330b02](https://github.com/davidsneighbour/project-dashboard/commit/b330b024f25ce2fba5599a80ccab5d9478bb81b5))
* tag-based review rules (tag → inactivity_days override) (issue [#30](https://github.com/davidsneighbour/project-dashboard/issues/30)) ([1d18dcc](https://github.com/davidsneighbour/project-dashboard/commit/1d18dcc92a2e7a080bf56ecc3a006df25feb3c08))
* webhook receiver for real-time GitHub sync (issue [#27](https://github.com/davidsneighbour/project-dashboard/issues/27)) ([410aed5](https://github.com/davidsneighbour/project-dashboard/commit/410aed54da5ca69d8fd259f5b3dc321c83097b00))

### Bug fixes

* **CardMenu:** cap desktop menu height to prevent overflow past viewport ([2641103](https://github.com/davidsneighbour/project-dashboard/commit/2641103c6684caf6a4981afa66af705a0293c5b6))
* **ci:** resolve E2E viewport overflow, markdown lint, and bump Node to 26 ([65d8fdc](https://github.com/davidsneighbour/project-dashboard/commit/65d8fdcb38623c7d83422a6580134c141e85c127))
* **docker:** fix docker compose up — USER root, drop apk build tools, fix CMD ([3acda5f](https://github.com/davidsneighbour/project-dashboard/commit/3acda5f8062be8977d25616794983346bbed329d))
* **e2e:** align DEFAULT_INACTIVITY mock from 3 → 7 to match server default (issue [#33](https://github.com/davidsneighbour/project-dashboard/issues/33)) ([cf800a8](https://github.com/davidsneighbour/project-dashboard/commit/cf800a85c66a22a8b2eec3150eb784d626ef16c0))

### Refactoring

* **server:** split index.js into focused modules (issue [#22](https://github.com/davidsneighbour/project-dashboard/issues/22)) ([6211ff4](https://github.com/davidsneighbour/project-dashboard/commit/6211ff4147e2e6440b3466ab91407a0e4e0aa475))

### Documentation

* add ROADMAP.md with post-audit issues and suggested work order ([f9e93de](https://github.com/davidsneighbour/project-dashboard/commit/f9e93de9211f01081da71d6edac4890db02ca67a)), closes [#33](https://github.com/davidsneighbour/project-dashboard/issues/33)

### Tests

* **coverage:** fix threshold failures across client and server (issue [#21](https://github.com/davidsneighbour/project-dashboard/issues/21)) ([a9e9365](https://github.com/davidsneighbour/project-dashboard/commit/a9e93657b0e1ddd5dd8ba165e381b15f7a0a0fce))

### Build system

* **docker:** bump base image to node:26-bookworm-slim ([4b02c51](https://github.com/davidsneighbour/project-dashboard/commit/4b02c5139b3984f0f94f28c241692afb30740485))
* **docker:** switch to cgr.dev/chainguard/node to eliminate CVEs ([79532f2](https://github.com/davidsneighbour/project-dashboard/commit/79532f2a738d108b7a975db1130f96770eab7f80))

## [1.0.0](https://github.com/davidsneighbour/project-dashboard/compare/v0.1.0...v1.0.0) (2026-06-12)

## 0.1.0 (2026-06-12)

### Features

* add markdown linting scripts to package.json ([4d6de38](https://github.com/davidsneighbour/project-dashboard/commit/4d6de3803f091c7d06b90eb48a79f10861bd317a))
* **backup:** export/import all triage state as JSON ([4bd3ec1](https://github.com/davidsneighbour/project-dashboard/commit/4bd3ec1cd945292d4624578e57f26b2a2ff66fcf))
* **board:** per-column filter + vertical scroll per column ([c377fb4](https://github.com/davidsneighbour/project-dashboard/commit/c377fb481ad80c977a2e6b09d4865b4f3d20a56b))
* **board:** work through todo.md board/UX improvements ([6c05c7a](https://github.com/davidsneighbour/project-dashboard/commit/6c05c7a11226a11ebb752744a2dcfec96545f910))
* **bulk:** add Remove tag action to BulkBar (closes [#14](https://github.com/davidsneighbour/project-dashboard/issues/14)) ([efe056a](https://github.com/davidsneighbour/project-dashboard/commit/efe056aca596ae4b7c2aa9d0b0ed826dc8fc8571))
* **CardMenu:** surface GitHub topics as one-click suggested tag chips ([b5c3042](https://github.com/davidsneighbour/project-dashboard/commit/b5c3042b6c261d6d4c2cabb1d237cbeb1603d6cc))
* **cli:** `report` command (markdown/csv/json) ([2b2e1e1](https://github.com/davidsneighbour/project-dashboard/commit/2b2e1e109865a776e2e7e59fc8b65c940da16cbd))
* **client:** add cache-first board hydration ([d9bd511](https://github.com/davidsneighbour/project-dashboard/commit/d9bd51163035c267f2ef604e67ecea2d277aa633))
* **client:** add F1 help dialog with markdown and mermaid ([457f717](https://github.com/davidsneighbour/project-dashboard/commit/457f7179114a2a397909526f1f164127b12ce54e))
* **client:** add lucide icons across controls ([a311d90](https://github.com/davidsneighbour/project-dashboard/commit/a311d90f0e02b9b2bbf6ab2a077ff06f35a9ee08))
* **cli:** priority command + --priority filter; clear uses /clear ([d0cb934](https://github.com/davidsneighbour/project-dashboard/commit/d0cb93458fbcde9fd2b505d0e313c04312c5c118))
* **cli:** repo-triage companion CLI ([b2f6889](https://github.com/davidsneighbour/project-dashboard/commit/b2f68893fd72b84d75bcd1ef1abd7d77c881e669))
* **display:** card density toggle (comfortable/compact) ([248d7af](https://github.com/davidsneighbour/project-dashboard/commit/248d7af6247652b4da55e7ff905f42088c27e9b5))
* **display:** card field visibility toggles ([53a40ea](https://github.com/davidsneighbour/project-dashboard/commit/53a40eafcde0297721eb0299d3894c11c519d15a))
* **display:** group the board by owner, tag, or language ([0e3c530](https://github.com/davidsneighbour/project-dashboard/commit/0e3c5309cf5dab6fac2eca795a4f8e2005b6ae75))
* **display:** repo stats on cards + clear button on column filters ([51939e4](https://github.com/davidsneighbour/project-dashboard/commit/51939e48c6abd5673483e11bd28fae88311c8c6e))
* **display:** sortable list/table view as a board alternative ([edfd689](https://github.com/davidsneighbour/project-dashboard/commit/edfd689ba2b40b1d303341a83cfdf0d67726134c))
* **display:** within-column sort selector ([464da8c](https://github.com/davidsneighbour/project-dashboard/commit/464da8ca02a49c5e6e01c08e0eb9a13f9af82ef8))
* **e2e:** add Playwright smoke tests (closes [#12](https://github.com/davidsneighbour/project-dashboard/issues/12)) ([5814653](https://github.com/davidsneighbour/project-dashboard/commit/5814653a0a40120d97555267ff0c114fbbd08e2b))
* **enrich:** per-repo metadata enrichment via gh api graphql (opt-in) ([1776ecf](https://github.com/davidsneighbour/project-dashboard/commit/1776ecf4eb7a122b478ddaf7bab6a089e4921389)), closes [#3](https://github.com/davidsneighbour/project-dashboard/issues/3)
* **flags:** generic per-repo boolean flags (pinned, muted, needs-decision) ([785fbda](https://github.com/davidsneighbour/project-dashboard/commit/785fbda2be9a0262761d1a26897203c246b50e62)), closes [#9](https://github.com/davidsneighbour/project-dashboard/issues/9)
* **github:** enrich repo metadata with the free REST fields ([2458e62](https://github.com/davidsneighbour/project-dashboard/commit/2458e62aff55a5a34dfe53b9dab736dfe881ac25))
* **mobile:** responsive single-column board with long-press scheduling ([c535385](https://github.com/davidsneighbour/project-dashboard/commit/c535385445349884174465b54090979a18b8d7cd)), closes [#17](https://github.com/davidsneighbour/project-dashboard/issues/17) [#18](https://github.com/davidsneighbour/project-dashboard/issues/18) [#19](https://github.com/davidsneighbour/project-dashboard/issues/19) [#12](https://github.com/davidsneighbour/project-dashboard/issues/12)
* multi-owner loading + accurate "checked" age ([1c104bd](https://github.com/davidsneighbour/project-dashboard/commit/1c104bdec3ebe65e6879547bd0cb9f1e0aead278))
* **notices:** two-step confirm before deleting a notice ([c9fb00c](https://github.com/davidsneighbour/project-dashboard/commit/c9fb00cd0c5ed3cc6f3d9d38e4a36237b79a8c2c))
* **priority:** independent priority filter in the toolbar ([936e241](https://github.com/davidsneighbour/project-dashboard/commit/936e24184ca905bd4ca0a6614f5905e8179c7ab0))
* **priority:** set and show triage priority on cards ([d16c24e](https://github.com/davidsneighbour/project-dashboard/commit/d16c24ea15768b30ffbe42e8323252b211d3ac5c))
* **report:** add weekly triage digest report kind ([07e4dbf](https://github.com/davidsneighbour/project-dashboard/commit/07e4dbf8191576f8a0a17eb80848c9ae6cd744a1))
* **reports:** Reports dialog in the UI ([58761f7](https://github.com/davidsneighbour/project-dashboard/commit/58761f70378770ca6dae1e00be94c2fc1643a4d6))
* **schedule,view:** configurable day-rollover hour + faster view switch ([78c08eb](https://github.com/davidsneighbour/project-dashboard/commit/78c08eb61c4190c1afea06e3a69345111d3e951f))
* **server:** /api/health liveness/readiness probe ([57a65ad](https://github.com/davidsneighbour/project-dashboard/commit/57a65ad17ddc8326cc4518a9734ea52a59824957))
* **server:** fall back to `gh auth token` when GITHUB_TOKEN is unset ([a95299b](https://github.com/davidsneighbour/project-dashboard/commit/a95299b89c72ac355567c82ff772c2e26b59685c))
* **server:** repo tags — repo_tag table + tags API ([4cd353e](https://github.com/davidsneighbour/project-dashboard/commit/4cd353e83806aa68bf148aa0a68ff70ee0924460))
* **server:** report builder + /api/reports endpoint ([ac9a55f](https://github.com/davidsneighbour/project-dashboard/commit/ac9a55fb37ab606493532ea836d5d9a0257400e0))
* **tags:** per-card "+ tag" affordance for discoverable tagging ([644d080](https://github.com/davidsneighbour/project-dashboard/commit/644d0804bfb5e7da035d99be8781b9a20b8f7a93))
* **tags:** tag chips on cards, card-menu management, toolbar tag filter ([8ae3a7a](https://github.com/davidsneighbour/project-dashboard/commit/8ae3a7a02189dceb1de8ad30dc8ed47fbaaea461))
* **undo:** faithful undo for notice deletion and clear-check ([b0ff74c](https://github.com/davidsneighbour/project-dashboard/commit/b0ff74cd8a892eea075a2a0213de3c4341b64a39))
* **usability:** multi-select cards with bulk actions ([f651bfd](https://github.com/davidsneighbour/project-dashboard/commit/f651bfdd134815b58394315b37235d26cb470505))
* **usability:** undo toast for ignore (single + bulk) ([c6907ca](https://github.com/davidsneighbour/project-dashboard/commit/c6907ca8fecbf942e652af97dfc0d8f909a7f373))

### Bug Fixes

* **ci:** make markdown-lint blocking (closes [#15](https://github.com/davidsneighbour/project-dashboard/issues/15)) ([d596f1b](https://github.com/davidsneighbour/project-dashboard/commit/d596f1b3982b94cd17da609eb8fdde6cdb0e8295))
* filter issues ([e75918a](https://github.com/davidsneighbour/project-dashboard/commit/e75918adb37a6c59d601eb0ac93ef5b6fd4d580c))
* get a working prototype ([03f3ad2](https://github.com/davidsneighbour/project-dashboard/commit/03f3ad2ad7ed56d7a9d9e2fcbc75496e783a6f72))
* local changes in Dockerfile and workspace settings ([fb492fc](https://github.com/davidsneighbour/project-dashboard/commit/fb492fcfd0612775acb401e6132a5cfadb2c15b8))
* make local dev server listen on local network ([4496d6e](https://github.com/davidsneighbour/project-dashboard/commit/4496d6e2151f3f6d77c2e10b4474e915a53385c5))
* migrate to tailwind 4 ([1d3447e](https://github.com/davidsneighbour/project-dashboard/commit/1d3447edce64d4a2b9b1a82e960fabe3b038e966))
* settings via .env file, fixes to aging process ([5f918ea](https://github.com/davidsneighbour/project-dashboard/commit/5f918eaaa9e893f8731f94d8f3bf936b35bf98b4))
* update reloading logic and mermaid diagram ([4877287](https://github.com/davidsneighbour/project-dashboard/commit/4877287be384a92ec2701a504eb79f46900e1fed))

### Refactoring

* **client:** split App.jsx into per-component files ([0dc09a4](https://github.com/davidsneighbour/project-dashboard/commit/0dc09a4d426e01a015b56191720ec6fb6b0cf5f7))
* **priority:** decouple triage priority from the check/schedule flow ([6cdf715](https://github.com/davidsneighbour/project-dashboard/commit/6cdf715acb984ec8916c30b929cf69f2b61e11d3))

### Documentation

* add JSDoc API documentation with clean-jsdoc-theme ([b0e4119](https://github.com/davidsneighbour/project-dashboard/commit/b0e4119a72db353c43bf7dc1e27a6c5e0244ba30))
* **agents:** reconcile AGENTS.md with current reality ([dbf15e2](https://github.com/davidsneighbour/project-dashboard/commit/dbf15e2b271688ffc81757ba001a5011e17e7c20))
* clean up todo.md to a GitHub-issue index; refresh help + CLAUDE ([9c19a36](https://github.com/davidsneighbour/project-dashboard/commit/9c19a36df976e8084acac82ac142f20fece51f01)), closes [#16](https://github.com/davidsneighbour/project-dashboard/issues/16)
* **env:** drop the deprecated GITHUB_USERNAME alias from .env.example ([820c109](https://github.com/davidsneighbour/project-dashboard/commit/820c109aea8c0dd1ebc92cf71647279e9785a735))
* **help:** extensive in-app user guide via F1 and the Help button ([57f0790](https://github.com/davidsneighbour/project-dashboard/commit/57f07901410905d2a76baeec7502706bac9e8ff1))
* **priority:** document triage priority; cover useDialog focus trap ([633fa26](https://github.com/davidsneighbour/project-dashboard/commit/633fa260119a057353498d11eb69f00f7b685798))
* refresh README for current features and stack ([0e26d75](https://github.com/davidsneighbour/project-dashboard/commit/0e26d7525cb9c93fabe4173b188f83a915f0ac1b))
* **todo:** mark open-PR cleanup done (Dependabot Vite PR superseded) ([e9f1656](https://github.com/davidsneighbour/project-dashboard/commit/e9f16566361dce74503f3e4945aaef0c3154eaca))
* **todo:** mark P2 resolved and refresh testing roadmap ([88dc3e1](https://github.com/davidsneighbour/project-dashboard/commit/88dc3e192f193ad36aa61e60529b9a9e7d3d8169))
* **todo:** record deprecation audit findings ([91c9774](https://github.com/davidsneighbour/project-dashboard/commit/91c97743077638e1541958129391209aec849c21))
* **todo:** record gh-api-paginate deferral rationale ([252afd7](https://github.com/davidsneighbour/project-dashboard/commit/252afd7c9961fc8b99e7c3e6e52b2eee41276a28))
* **todo:** refresh roadmap and mark gh auth fallback done ([4812cfd](https://github.com/davidsneighbour/project-dashboard/commit/4812cfd06507c6fd60a3097c5d79250b476fd261))
* update documentation to current state ([b586a5d](https://github.com/davidsneighbour/project-dashboard/commit/b586a5dfd9149c45d70318d08e06345f84635d07))
* update README.md ([97b119a](https://github.com/davidsneighbour/project-dashboard/commit/97b119a97864bd277db84ca7deef54a6728e1e4c))

### Styles

* phosphor-green tint on the neutral chrome ramp ([1733442](https://github.com/davidsneighbour/project-dashboard/commit/173344280cfd5d861534d65dc32ec0a397b2bd54))

### Tests

* **a11y:** add axe-core automated checks for wcag2a/2aa compliance ([90ce662](https://github.com/davidsneighbour/project-dashboard/commit/90ce66205a7a536d0a9fe7b1afe945ba3631e3c8))
* add vitest foundations and schedule coverage ([36ea18c](https://github.com/davidsneighbour/project-dashboard/commit/36ea18c4c945bf891c3980130b754bf88a45bda4))
* **client:** add behavior coverage and refine test setup ([be8a3e3](https://github.com/davidsneighbour/project-dashboard/commit/be8a3e3755a0d9adf7eb28831cfa6fa84447bf65))
* **client:** add P2 API and interaction coverage ([a6201e8](https://github.com/davidsneighbour/project-dashboard/commit/a6201e8dea945eaf9e149d66de298dd5d90b15f4))
* **coverage:** restore server + CLI coverage to the enforced floors ([71e59f6](https://github.com/davidsneighbour/project-dashboard/commit/71e59f6c37311e02cc347203f47148dacf60d933))
* **fix:** update coverage thresholds ([d09f154](https://github.com/davidsneighbour/project-dashboard/commit/d09f154b7d0d84985acf12ccf31a7f1b28b125d8))
* **server:** export app for in-process route tests + add API contract suite ([6c7b09a](https://github.com/davidsneighbour/project-dashboard/commit/6c7b09ac7bf24718535f8d05999a7df576449444))
* silence benign Vite esbuild/oxc deprecation warning ([54f5273](https://github.com/davidsneighbour/project-dashboard/commit/54f5273704109384e7189c4fb3e46ba9e7ac0ac1))
* wire root test:coverage script and prune completed todo items ([dd0d48c](https://github.com/davidsneighbour/project-dashboard/commit/dd0d48c2804ed18b0b280b254ea105301d85fe25))

### Build System

* **dev:** add no-docker run path and upgrade better-sqlite3 to 12 ([698dee7](https://github.com/davidsneighbour/project-dashboard/commit/698dee7fa55f255cb63f902a16eed1cb2008f18f))
* **release:** add release-it configuration with conventional changelog ([dba9217](https://github.com/davidsneighbour/project-dashboard/commit/dba92172180bb09a837ca42f8bb5e0c0bf21f4c2))
* **vscode:** update workspace configuration ([a52c99d](https://github.com/davidsneighbour/project-dashboard/commit/a52c99d9f8d683f848e11fb8bc2677bb46d3f56c))

### CI

* GitHub Actions for tests/coverage + advisory markdown lint ([6d15eb4](https://github.com/davidsneighbour/project-dashboard/commit/6d15eb48411ff9d0908de2f08945349089287984))

### Miscellaneous

* add LICENSE and markdownlint config ([9ddd563](https://github.com/davidsneighbour/project-dashboard/commit/9ddd563419c7b5d001f581e94bf7cd3391d54be9))
* cleanup repo structure ([f4dac2a](https://github.com/davidsneighbour/project-dashboard/commit/f4dac2ace28be5964f6789dd8130509b077eb029))
* **deps:** upgrade to Vite 8, React 19, plugin-react 6, Express 5 ([a946982](https://github.com/davidsneighbour/project-dashboard/commit/a9469823e2d038ee3534b822fa52d0fd46ad29ec))
* initial commit, claude.ai output ([65743a1](https://github.com/davidsneighbour/project-dashboard/commit/65743a1b5065b0ececc7a66c1ee75c52adcebeb7))
* rename from project-status-dashboard-thingy to project-dashboard ([da680ff](https://github.com/davidsneighbour/project-dashboard/commit/da680ff8906e849be1fa08ef35e853ce355593a4))
* **spelling:** add cspell config (en-GB) + project dictionary ([c8b9e18](https://github.com/davidsneighbour/project-dashboard/commit/c8b9e18f901d89d390a74052bd789dade92eb57f))
* workspace updates ([3e94b33](https://github.com/davidsneighbour/project-dashboard/commit/3e94b33081c11762c387574b9b97b222995bf69a))
