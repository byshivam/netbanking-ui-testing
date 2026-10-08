import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT || 4173);

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a planted bug must fail every time, and a flaky test should be fixed, not retried.
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: process.env.PW_HTML_DIR || "playwright-report" }],
    ["json", { outputFile: process.env.PW_JSON_FILE || "test-results/results.json" }],
    [
      "allure-playwright",
      {
        resultsDir: process.env.PW_ALLURE_DIR || "allure-results",
        environmentInfo: {
          app: "Arya Bank NetBanking (fictional)",
          planted_bugs: process.env.UI_BUGS || "none",
          node: process.version,
        },
      },
    ],
  ],
  outputDir: process.env.PW_OUTPUT_DIR || "test-results",
  // Baselines are created once in CI (Playwright Docker image, see the workflow) and committed;
  // a missing or changed screenshot then fails the test.
  updateSnapshots: "none",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node app/server.mjs",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI && !process.env.UI_BUGS,
    env: { PORT: String(PORT), UI_BUGS: process.env.UI_BUGS ?? "none" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grepInvert: /@visual/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grepInvert: /@visual/ },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] }, grepInvert: /@visual/ },
  ],
});
