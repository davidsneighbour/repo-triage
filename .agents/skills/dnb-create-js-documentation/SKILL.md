---
id: dnb-create-js-documentation
name: dnb-create-js-documentation
title: DNB Create JS Documentation
description: Add or improve generated API documentation for JavaScript or TypeScript npm projects. Use when the user asks to add API docs, JSDoc, TypeDoc, generated documentation, documentation comments for exported APIs, or a docs:api script. Do not use for general README writing, tutorials, architecture documentation, changelogs, or user-facing guides unless generated public API documentation is explicitly requested.
version: 1.0.0
tags:
- javascript
- typescript
- npm
- jsdoc
- typedoc
- api-documentation
- generated-docs
---

Add generated API documentation to the current JavaScript or TypeScript project.

The goal is to document the public API surface with maintainable generated documentation, not to create general project documentation.

Prefer:

- JSDoc for JavaScript projects.
- TypeDoc for TypeScript projects.
- Existing project conventions over the defaults in this skill.

Do not document internal implementation details unless they are exported as part of the public API.

## Trigger scope

Use this skill when the user asks for any of the following:

- Add API documentation.
- Add JSDoc documentation.
- Add TypeDoc documentation.
- Generate public API docs.
- Add a `docs:api` script.
- Document exported functions, classes, modules, or constants.
- Set up generated documentation for a JavaScript or TypeScript package.

Do not use this skill for:

- README rewrites.
- Tutorial documentation.
- Architecture documentation.
- User guides.
- Marketing pages.
- Changelogs.
- Inline comments that are not related to exported/public API documentation.

## Project inspection

Before changing files, inspect the project.

Determine:

1. Whether the project is JavaScript or TypeScript.
2. Whether the package uses ESM, CommonJS, or both.
3. Whether the project already uses JSDoc, TypeDoc, or another documentation generator.
4. Which files define the public API surface.
5. Whether the package has an explicit entry point in `package.json`.
6. Whether `exports`, `main`, `module`, `types`, or `bin` fields exist in `package.json`.
7. Whether `src/index.js`, `src/index.ts`, or equivalent entry files exist.
8. Whether public API files live outside `src/`.
9. Whether generated folders such as `docs/`, `dist/`, `coverage/`, or `public/` are committed or ignored.
10. Which validation scripts already exist.

Use the actual repository structure. Do not blindly use example paths.

## Public API detection

Treat these as likely public API entry points:

- Files referenced by `package.json` fields:

  - `exports`
  - `main`
  - `module`
  - `types`
  - `typings`
  - `bin`
- `src/index.js`
- `src/index.ts`
- Files re-exported from the main entry point.
- Files documented as public in the README.
- CLI entry files when the package exposes a command.
- Public library files explicitly exported by the package.

Do not include every source file by default.

For packages with an `exports` map, derive the documentation entry points from the exported files.

For monorepos, work only in the relevant package unless the user explicitly asks to update all packages.

## Tool selection

### Use JSDoc when

Use JSDoc when the project is primarily JavaScript.

Install:

```bash
npm install --save-dev jsdoc clean-jsdoc-theme
```

Create or update `jsdoc.config.json`.

### Use TypeDoc when

Use TypeDoc when the project is primarily TypeScript.

Install:

```bash
npm install --save-dev typedoc
```

Use TypeDoc instead of JSDoc for TypeScript unless the repository already uses JSDoc successfully or the user explicitly requests JSDoc.

Do not add manual `@type` annotations in TypeScript files unless they add information that is not already expressed by the type system.

### Existing tooling rule

If the project already has API documentation tooling:

1. Prefer extending the existing setup.
2. Do not replace it unless it is clearly broken, abandoned, or inappropriate for the language.
3. Explain the reason before replacing it.
4. Avoid adding both JSDoc and TypeDoc unless the project already uses both or the user explicitly asks for both.

## JavaScript implementation with JSDoc

Create `jsdoc.config.json` in the project root unless an existing JSDoc config should be updated.

Use this structure as a baseline and replace `source.include` with the actual public API files:

```json
{
  "source": {
    "include": [
      "src/index.js"
    ],
    "excludePattern": "(node_modules|dist|docs|coverage)"
  },
  "opts": {
    "destination": "./docs/api",
    "recurse": false,
    "readme": "README.md",
    "package": "./package.json",
    "template": "node_modules/clean-jsdoc-theme"
  },
  "plugins": ["plugins/markdown"],
  "templates": {
    "cleverLinks": true,
    "monospaceLinks": true,
    "default": {
      "includeDate": false
    }
  },
  "clean-jsdoc-theme-opts": {
    "title": "<package-name> API",
    "search": true,
    "moduleDirectories": ["src/lib", "src"]
  }
}
```

Replace `<package-name>` with the package name from `package.json`.

Set `source.include` to the smallest accurate list of public API files.

Set `recurse` to `false` unless the project has a deliberate public API directory that should be recursively documented.

If the package uses ESM, document exported modules and functions in a way that JSDoc can resolve.

## TypeScript implementation with TypeDoc

Create `typedoc.json` in the project root unless an existing TypeDoc config should be updated.

Use this structure as a baseline:

```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api"
}
```

Replace `entryPoints` with the actual public API entry points.

For packages with an `exports` map, use the exported TypeScript entry files where possible.

If the project needs Markdown output and the user requested Markdown, install and configure `typedoc-plugin-markdown`. Do not add it otherwise.

Optional Markdown setup:

```bash
npm install --save-dev typedoc-plugin-markdown
```

```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "plugin": ["typedoc-plugin-markdown"]
}
```

## Documentation comments

Add documentation comments to public API files only.

### File/module comments

For JavaScript public API files, add or convert a file-level module block where useful:

```js
/**
 * @module <module-name>
 * @description <short useful description>
 */
```

Use the module name that best matches how the API is imported.

Do not add vague descriptions such as "Utility functions" if the file has a clearer purpose.

### Functions and methods

For public API functions, add useful JSDoc:

```js
/**
 * <Short description of what the function does.>
 *
 * @param {string} input - Description of the input.
 * @returns {string} Description of the returned value.
 * @throws {Error} Description of when this throws.
 *
 * @example
 * const result = myFunction("value");
 */
```

Only add `@throws` if the function can throw in normal expected usage.

Only add `@example` when a short example improves understanding.

### Constants

For exported JavaScript constants, add `@type`:

```js
/**
 * Description of the exported constant.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const values = Object.freeze({});
```

Do not add `@type` in TypeScript unless the annotation adds useful documentation beyond the declared type.

### Classes

For public classes, document:

- Constructor purpose.
- Constructor parameters.
- Public methods.
- Public properties.
- Expected usage.
- Thrown errors where relevant.

### TypeScript comments

For TypeScript, keep comments concise.

Prefer explaining:

- Intent.
- Constraints.
- Usage.
- Parameters when not obvious.
- Return semantics.
- Errors.
- Examples.

Do not duplicate obvious type information.

Bad:

```ts
/**
 * @param name string
 * @returns string
 */
export function greet(name: string): string {
  return `Hello ${name}`;
}
```

Better:

```ts
/**
 * Builds the display greeting used by the CLI output.
 */
export function greet(name: string): string {
  return `Hello ${name}`;
}
```

## Package scripts

Add a `docs:api` script to `package.json`.

For JSDoc:

```json
{
  "scripts": {
    "docs:api": "jsdoc -c jsdoc.config.json"
  }
}
```

For TypeDoc:

```json
{
  "scripts": {
    "docs:api": "typedoc"
  }
}
```

Preserve existing scripts.

If `docs:api` already exists, update it only if required.

## Build integration

Integrate documentation generation into the existing build only when this matches the project style or the user requested it.

If adding docs generation to `build`, preserve the existing command.

Use this pattern:

```json
{
  "scripts": {
    "build": "<existing-build-command> && npm run docs:api"
  }
}
```

Do not replace the existing build command with only `npm run docs:api`.

If the build already chains multiple commands, append `&& npm run docs:api`.

If the project intentionally keeps documentation separate from build output, do not force integration. Add only `docs:api` and report that documentation generation remains separate.

## Git ignore rules

Generated API docs should usually not be committed.

Add this to `.gitignore` if it is not already covered:

```gitignore
docs/api
```

Do not ignore all of `docs/` if the repository contains hand-written documentation there.

If the repository already commits generated documentation, do not add the ignore rule. Report that generated docs appear to be committed by convention.

## ESLint ignore rules

Generated documentation may include bundled third-party JavaScript. Exclude generated docs from linting.

For ESLint flat config, add or merge:

```js
{
  ignores: ["dist/**", "node_modules/**", "docs/api/**"]
}
```

Prefer `docs/api/**` over `docs/**` when the repository has hand-written documentation in `docs/`.

For legacy ESLint config, add this to `.eslintignore`:

```gitignore
docs/api/
```

Do not create duplicate or conflicting ESLint configuration.

If the project has no ESLint setup, do not add ESLint solely for this task.

## Repository conventions

Follow the project’s existing conventions.

For npm projects:

- Use `npm`.
- Do not introduce yarn, pnpm, or bun unless the project already uses them.
- Respect existing lock files.
- If `package-lock.json` exists, allow it to update after installing dependencies.
- Do not delete lock files.

For Node projects:

- Respect the existing Node engine policy in `package.json`.
- Do not downgrade syntax or module style.
- Preserve ESM/CommonJS conventions.

For TypeScript projects:

- Preserve strictness.
- Do not introduce `any`.
- Do not weaken compiler settings.
- Do not add redundant JSDoc types for already typed APIs.

## Validation

After implementation, run:

```bash
npm run docs:api
```

Confirm that `docs/api/` is generated.

Then run relevant existing project validation commands.

Prefer commands that already exist in `package.json`, such as:

```bash
npm test
npm run build
npm run lint
npm run typecheck
npx astro check
```

Only run commands that are relevant and available.

If a validation command fails:

1. Fix failures caused by this task.
2. Do not fix unrelated failures unless required to verify the documentation setup.
3. Report unrelated failures clearly.
4. Include the failing command and the relevant error message.

## Safety and change control

Do not:

- Document private/internal files unless exported publicly.
- Add both JSDoc and TypeDoc without a clear reason.
- Replace existing docs tooling without justification.
- Commit generated `docs/api` output unless this repository already commits generated docs.
- Overwrite hand-written documentation.
- Ignore all of `docs/` if it contains source documentation.
- Destructively rewrite build scripts.
- Change package manager.
- Weaken lint, type-checking, or test configuration.
- Add broad ignore rules that hide important source files.
- Make unrelated refactors.

## Completion report

When finished, report:

1. Whether JSDoc or TypeDoc was used, and why.
2. Which public API entry points were documented.
3. Which config files were created or changed.
4. Which package scripts were added or changed.
5. Whether generated docs are ignored or committed by convention.
6. Which validation commands were run.
7. PASS/FAIL for each validation command.
8. Any warnings or follow-up work needed.

Keep the report concise and specific.
