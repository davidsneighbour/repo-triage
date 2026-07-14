/**
 * @see https://github.com/lint-staged/lint-staged
 * @type {import('lint-staged').Configuration}
 */
export default {
  '.github/workflows/*.{yml,yaml}': ['zizmor'],

  '!(CHANGELOG)**/*.{md,mdx}': [
    'markdownlint-cli2 --config ./node_modules/@dnbhq/markdownlint-config/.markdownlint-cli2.jsonc',
    'cspell',
  ],
};
