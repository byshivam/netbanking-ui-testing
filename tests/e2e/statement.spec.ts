import { CURRENT, SAVINGS, expect, test } from "../fixtures";

test.describe("Statement", { tag: "@e2e" }, () => {
  test.beforeEach(async ({ loggedIn, statement }) => {
    await statement.goto();
  });

  test("default view: salary account from 1 Sep to today", async ({ statement }) => {
    await expect(statement.count).toHaveText("11 transactions");
    await expect(statement.rows.first()).toHaveAttribute("data-date", "2026-10-06");
  });

  test("September only: right rows and totals", async ({ statement }) => {
    await statement.filter(SAVINGS, "2026-09-01", "2026-09-30");
    await expect(statement.count).toHaveText("7 transactions");
    const dates = await statement.rows.evaluateAll((rows) => rows.map((r) => r.getAttribute("data-date") ?? ""));
    expect(dates.every((d) => d >= "2026-09-01" && d <= "2026-09-30")).toBe(true);
    await expect(statement.totalCredits).toHaveText("Credits ₹86,200.00");
    await expect(statement.totalDebits).toHaveText("Debits ₹27,748.75");
  });

  test("range boundaries are inclusive", async ({ statement }) => {
    await statement.filter(CURRENT, "2026-09-15", "2026-09-22");
    await expect(statement.count).toHaveText("2 transactions");
    await expect(statement.rows.nth(0)).toHaveAttribute("data-date", "2026-09-22");
    await expect(statement.rows.nth(1)).toHaveAttribute("data-date", "2026-09-15");
  });

  test("a period with no transactions shows an empty state", async ({ statement }) => {
    await statement.filter(CURRENT, "2026-08-01", "2026-08-31");
    await expect(statement.empty).toBeVisible();
    await expect(statement.rows).toHaveCount(0);
  });

  test("From after To is rejected", async ({ statement }) => {
    await statement.filter(SAVINGS, "2026-10-05", "2026-10-01");
    await expect(statement.rangeError).toHaveText("The From date must be on or before the To date.");
  });

  test("a new transfer shows up in the statement", async ({ transfer, statement }) => {
    await transfer.goto();
    await transfer.startReview({ from: SAVINGS, to: "Ravi Iyer", amount: "42.50" });
    await transfer.confirm.click();
    await expect(transfer.success).toBeVisible();
    await statement.goto();
    await expect(statement.count).toHaveText("12 transactions");
    await expect(statement.rows.first()).toContainText("Transfer to Ravi Iyer");
    await expect(statement.rows.first()).toContainText("₹42.50");
  });
});
