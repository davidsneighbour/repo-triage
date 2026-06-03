import { defineConfig } from 'vitest/config';
import { createLogger } from 'vite';
import react from '@vitejs/plugin-react';

// Vitest 4 bundles a Rolldown-based Vite (v8) that prefers oxc, while the classic
// (babel) React plugin we use for the production build still sets the now-deprecated
// `esbuild` JSX options. That mismatch only surfaces here, as a harmless warning
// (oxc transforms JSX fine). Filter just those lines so test output stays clean;
// everything else logs normally.
const SILENCE = /vite:react-babel|use `oxc` instead|optimizeDeps\.esbuildOptions|rolldownOptions/;
const base = createLogger();
const customLogger = {
    info: (m, o) => base.info(m, o),
    warn: (m, o) => {
        if (!SILENCE.test(m)) base.warn(m, o);
    },
    warnOnce: (m, o) => {
        if (!SILENCE.test(m)) base.warnOnce(m, o);
    },
    error: (m, o) => base.error(m, o),
    clearScreen: (t) => base.clearScreen(t),
    hasErrorLogged: (e) => base.hasErrorLogged(e),
    get hasWarned() {
        return base.hasWarned;
    },
};

export default defineConfig({
    customLogger,
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
