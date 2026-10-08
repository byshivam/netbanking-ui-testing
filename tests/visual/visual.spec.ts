// Visual regression. Baselines are created in the Playwright Docker image in CI
// (same fonts every run) and committed under visual.spec.ts-snapshots/.
// Runs on the chromium and mobile-chrome projects only (see playwright.config.ts).
import { SAVINGS, expect, test } from "../fixtures";

test.describe("Visual regression", { tag: "@visual" }, () => {
  test("login page", async ({ loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.page).toHaveScreenshot("login.png", { fullPage: true });
  });

  test("dashboard", async ({ loggedIn, dashboard }) => {
    await dashboard.goto();
    await expect(dashboard.recentRows).toHaveCount(5);
    await expect(dashboard.page).toHaveScreenshot("dashboard.png", { fullPage: true });
  });

  test("transfer review", async ({ loggedIn, transfer }) => {
    await transfer.goto();
    await transfer.startReview({ from: SAVINGS, to: "Ravi Iyer", amount: "1500.75", remarks: "Dinner" });
    await expect(transfer.page).toHaveScreenshot("transfer-review.png", { fullPage: true });
  });

  test("statement", async ({ loggedIn, statement }) => {
    await statement.goto();
    await expect(statement.page).toHaveScreenshot("statement.png", { fullPage: true });
  });
});
