import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.js'],
        include: ['src/**/*.test.{js,jsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
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
