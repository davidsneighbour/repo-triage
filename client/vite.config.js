import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: process.env.VITE_HOST || process.env.HOST || "0.0.0.0",
    port: 5173,
    // In dev the React app runs on 5173 and proxies API calls to the backend.
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "dist" },
});
