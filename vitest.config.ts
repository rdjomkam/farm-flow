import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules/**", "src/__tests__/e2e/**"],
    // ADR-052 §3.1 — garde global : échoue bruyamment si process.env.CI est
    // défini sans DATABASE_URL, avant toute collecte de test.
    setupFiles: ["./src/test/ci-db-guard.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
