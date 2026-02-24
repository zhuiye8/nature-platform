/**
 * @input @playwright/test runtime, local frontend dev server at :5173, backend APIs at :18080
 * @output Playwright smoke test configuration with report artifacts under playwright-report/test-results
 * @position Frontend UI smoke automation entrypoint for login and key-page availability checks
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["smoke-*.spec.ts"],
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "playwright-report"
      }
    ]
  ],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true
  },
  webServer: {
    command: "pnpm dev --host localhost --port 5173",
    url: "http://localhost:5173/login",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
