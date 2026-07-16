import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const rootDir = path.resolve(import.meta.dirname, "..");

export default defineConfig(({ mode }) => {
  // Empty prefix loads every var (not just VITE_-prefixed) from the shared
  // root .env, matching where the backend reads its config from.
  const env = loadEnv(mode, rootDir, "");
  const httpsEnabled = /^(1|true)$/i.test(
    env.HTTPS_ENABLED || process.env.HTTPS_ENABLED || "",
  );
  const certFile =
    env.HTTPS_CERT_FILE ||
    process.env.HTTPS_CERT_FILE ||
    path.join(rootDir, "certs", "dev-cert.pem");
  const keyFile =
    env.HTTPS_KEY_FILE ||
    process.env.HTTPS_KEY_FILE ||
    path.join(rootDir, "certs", "dev-key.pem");
  const noTelemetry =
    env.NO_TELEMETRY ||
    process.env.NO_TELEMETRY ||
    env.VITE_NO_TELEMETRY ||
    process.env.VITE_NO_TELEMETRY ||
    "";

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.NO_TELEMETRY": JSON.stringify(noTelemetry),
    },
    server: {
      host: process.env.VITE_HOST || process.env.HOST || "0.0.0.0",
      port: 5173,
      https: httpsEnabled
        ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
        : undefined,
      // In dev the React app runs on 5173 and proxies API calls to the backend.
      proxy: {
        "/api": {
          target: `${httpsEnabled ? "https" : "http"}://localhost:8787`,
          // The backend's local-dev cert is trusted system-wide via
          // `mkcert -install`, but Node's proxy agent doesn't consult the
          // system trust store — skip verification for this local-only hop.
          secure: false,
        },
      },
    },
    build: { outDir: "dist" },
  };
});
