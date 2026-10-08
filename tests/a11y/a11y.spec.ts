// Accessibility: axe-core scans against WCAG 2.0-2.2 A/AA on every screen and
// state, plus checks axe can't do on its own (labels, keyboard-only use).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { SAVINGS, expect, test } from "../fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  await test.info().attach("axe-violations.json", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  expect(summary, `${summary.length} WCAG violation(s)`).toEqual([]);
}

test.describe("Accessibility (WCAG 2.2 AA)", { tag: "@a11y" }, () => {
  test("login page", async ({ loginPage }) => {
    await loginPage.goto();
    await expectNoViolations(loginPage.page);
  });

  test("login page showing an error", async ({ loginPage, customer }) => {
    await loginPage.goto();
    await loginPage.login(customer.customerId, "wrong-password");
    await expect(loginPage.error).toBeVisible();
    await expectNoViolations(loginPage.page);
  });

  test("dashboard", async ({ loggedIn, dashboard }) => {
    await dashboard.goto();
    await expect(dashboard.recentRows).toHaveCount(5);
    await expectNoViolations(dashboard.page);
  });

  test("transfer form with validation errors", async ({ loggedIn, transfer }) => {
    await transfer.goto();
    await transfer.review.click();
    await expect(transfer.fieldError("amount")).toBeVisible();
    await expectNoViolations(transfer.page);
  });

  test("transfer review step", async ({ loggedIn, transfer }) => {
    await transfer.goto();
    await transfer.startReview({ from: SAVINGS, to: "Ravi Iyer", amount: "100.00" });
    await expectNoViolations(transfer.page);
  });

  test("beneficiaries", async ({ loggedIn, beneficiaries }) => {
    await beneficiaries.goto();
    await expectNoViolations(beneficiaries.page);
  });

  test("statement", async ({ loggedIn, statement }) => {
    await statement.goto();
    await expectNoViolations(statement.page);
  });

  test("every form field has a visible label (placeholders are not labels)", async ({ page, loggedIn }) => {
    for (const path of ["/transfer", "/beneficiaries", "/statement"]) {
      await page.goto(path);
      await expect(page.locator("form").first()).toBeVisible();
      const unlabelled = await page.locator("form input, form select").evaluateAll((fields) =>
        fields
          .filter((f) => !(f as HTMLInputElement).labels?.length)
          .map((f) => `${f.tagName.toLowerCase()}#${f.id}`));
      expect(unlabelled, `fields without a <label> on ${path}`).toEqual([]);
    }
  });

  test("a transfer can be completed with the keyboard only", async ({ page, loggedIn, transfer, browserName, isMobile }) => {
    test.skip(isMobile, "no hardware keyboard on mobile");
    test.skip(browserName === "webkit", "Safari skips links and buttons on Tab unless the user turns that on");
    await transfer.goto();
    await transfer.from.focus();
    await page.keyboard.press("Tab"); // Pay to
    await expect(transfer.to).toBeFocused();
    await transfer.to.selectOption("BEN-1");
    await page.keyboard.press("Tab"); // Amount
    await page.keyboard.type("75.25");
    await page.keyboard.press("Enter"); // submits the form
    await expect(transfer.reviewAmount).toHaveText("₹75.25");
    await expect(page.getByRole("heading", { name: "Check and confirm" })).toBeFocused();
    await page.keyboard.press("Tab"); // Edit
    await page.keyboard.press("Tab"); // Confirm
    await expect(transfer.confirm).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(transfer.success).toBeVisible();
    await expect(transfer.success).toBeFocused();
  });
});
