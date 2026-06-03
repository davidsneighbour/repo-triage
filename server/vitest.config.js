import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            // Floors sit below current coverage (~86/78/75/87) so normal edits
            // don't trip CI; raise them as coverage improves.
            thresholds: {
                statements: 80,
                branches: 70,
                functions: 70,
                lines: 80,
            },
        },
    },
});
