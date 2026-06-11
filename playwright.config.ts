import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E tests.
 * Dev server runs on port 4200 (npm run dev).
 * Tests live in src/__tests__/e2e/
 */
export default defineConfig({
  testDir: "./src/__tests__/e2e",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Use nvm node v22 explicitly — the system node (v12) is too old for Next.js 16
    command:
      "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && source \"$NVM_DIR/nvm.sh\" && nvm use 22 && npm run dev'",
    url: "http://localhost:4200",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
