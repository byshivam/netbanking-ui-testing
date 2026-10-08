import { CURRENT, SAVINGS, expect, test } from "../fixtures";

test.describe("Dashboard", { tag: "@e2e" }, () => {
  test.beforeEach(async ({ loggedIn, dashboard }) => {
    await dashboard.goto();
  });

  test("shows both accounts with balances in Indian format", async ({ dashboard }) => {
    await expect(dashboard.balance(SAVINGS)).toHaveText("₹1,25,000.50");
    await expect(dashboard.balance(CURRENT)).toHaveText("₹48,250.00");
    await expect(dashboard.card(SAVINGS)).toContainText("Salary account");
    await expect(dashboard.card(CURRENT)).toContainText("CURRENT");
  });

  test("lists the five most recent transactions, newest first", async ({ dashboard }) => {
    await expect(dashboard.recentRows).toHaveCount(5);
    await expect(dashboard.recentRows.first()).toContainText("07 Oct 2026");
    await expect(dashboard.recentRows.first()).toContainText("GST payment");
  });

  test("credits are marked + and debits −", async ({ dashboard }) => {
    await expect(dashboard.recentRows.filter({ hasText: "Invoice 1003" })).toContainText("+₹12,500.00");
    await expect(dashboard.recentRows.filter({ hasText: "GST payment" })).toContainText("−₹10,000.00");
  });

  for (const [action, url] of [
    ["Send money", /\/transfer$/],
    ["Manage beneficiaries", /\/beneficiaries$/],
    ["Download statement", /\/statement$/],
  ] as const) {
    test(`quick action "${action}" opens the right page`, async ({ page, dashboard }) => {
      await dashboard.quickAction(action).click();
      await expect(page).toHaveURL(url);
    });
  }

  test("main navigation marks the current page", async ({ dashboard }) => {
    await expect(dashboard.header.link("Dashboard")).toHaveAttribute("aria-current", "page");
    await expect(dashboard.header.link("Statement")).not.toHaveAttribute("aria-current", "page");
  });
});
