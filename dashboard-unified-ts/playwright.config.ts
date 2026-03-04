import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the built app (npm run build && npm run preview) or dev server.
 * Use baseURL to point to your deployed URL for production smoke checks.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer:
    process.env.CI || process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: "npm run dev",
          url: "http://localhost:5173",
          reuseExistingServer: true,
        },
});
