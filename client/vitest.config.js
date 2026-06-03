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
            // Floors sit below current coverage (~91/83/88/90) so normal edits
            // don't trip CI; raise them as coverage improves.
            thresholds: {
                statements: 85,
                branches: 80,
                functions: 80,
                lines: 85,
            },
        },
    },
});
