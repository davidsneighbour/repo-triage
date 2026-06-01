import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the React app runs on 5173 and proxies API calls to the backend.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { outDir: 'dist' },
});
