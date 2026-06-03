import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['repo-triage.mjs'],
            // don't trip CI; raise as coverage improves.
            thresholds: {
                statements: 90,
                branches: 85,
                functions: 85,
                lines: 90,
            },
        },
    },
});
