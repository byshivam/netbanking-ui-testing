import { SAVINGS, expect, test } from "../fixtures";

test.describe("Send money", { tag: "@e2e" }, () => {
  test.beforeEach(async ({ loggedIn, transfer }) => {
    await transfer.goto();
  });

  test("transfer with paise: review, confirm, and the exact amount leaves the account", async ({ page, transfer, dashboard }) => {
    await transfer.startReview({ from: SAVINGS, to: "Ravi Iyer", amount: "1500.75", remarks: "Dinner" });
    await expect(transfer.reviewAmount).toHaveText("₹1,500.75");
    await expect(page.locator("#review-to")).toHaveText("Ravi Iyer · ACC-200311");

    await transfer.confirm.click();
    await expect(transfer.success).toBeVisible();
    await expect(transfer.successText).toContainText("₹1,500.75 sent to Ravi Iyer");
    await expect(transfer.successText).toContainText(/Reference TRF\d+/);

    await dashboard.goto();
    await expect(dashboard.balance(SAVINGS)).toHaveText("₹1,23,499.75"); // 1,25,000.50 − 1,500.75
    await expect(dashboard.recentRows.first()).toContainText("Transfer to Ravi Iyer — Dinner");
  });

  test("Edit on the review step goes back with the values kept", async ({ transfer }) => {
    await transfer.startReview({ to: "Meera Nair", amount: "250.00" });
    await transfer.edit.click();
    await expect(transfer.amount).toHaveValue("250.00");
    await expect(transfer.amount).toBeFocused();
  });

  test("beneficiary can be preselected from the URL", async ({ transfer }) => {
    await transfer.goto("?to=BEN-2");
    await expect(transfer.to).toHaveValue("BEN-2");
  });

  for (const [amount, message] of [
    ["", "Enter an amount."],
    ["0", "Amount must be more than ₹0."],
    ["0.00", "Amount must be more than ₹0."],
    ["-50", "Enter a number with up to 2 decimals"],
    ["10.999", "Enter a number with up to 2 decimals"],
    ["1e3", "Enter a number with up to 2 decimals"],
    ["100000.01", "The limit per transfer is ₹1,00,000."],
  ]) {
    test(`amount "${amount}" is rejected before review`, async ({ transfer }) => {
      await transfer.fill({ to: "Ravi Iyer", amount });
      await transfer.review.click();
      await expect(transfer.fieldError("amount")).toContainText(message);
      await expect(transfer.amount).toHaveAttribute("aria-invalid", "true");
      await expect(transfer.reviewAmount).toBeHidden();
    });
  }

  test("no beneficiary chosen is rejected", async ({ transfer }) => {
    await transfer.amount.fill("100");
    await transfer.review.click();
    await expect(transfer.fieldError("beneficiary")).toHaveText("Choose who to pay.");
  });

  test("insufficient funds: clear error and no money moves", async ({ transfer, dashboard, page }) => {
    await transfer.startReview({ from: "ACC-100202", to: "Ravi Iyer", amount: "50000.00" }); // balance 48,250.00
    await transfer.confirm.click();
    await expect(transfer.error).toContainText("Not enough balance in this account.");
    await expect(transfer.error).toContainText("No money has left your account.");
    await expect(transfer.success).toBeHidden();
    await dashboard.goto();
    await expect(dashboard.balance("ACC-100202")).toHaveText("₹48,250.00");
    await expect(page.locator("#recent")).not.toContainText("Transfer to Ravi Iyer");
  });

  test("double-clicking Confirm sends the money once", async ({ page, transfer }) => {
    await transfer.startReview({ from: SAVINGS, to: "Meera Nair", amount: "999.00" });
    // Two clicks in the same tick, like an impatient double tap. (A real dblclick lets the
    // second click land on whatever replaced the button, e.g. the "Back to dashboard" link on mobile.)
    await transfer.confirm.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(transfer.success).toBeVisible();
    const res = await page.request.get(`/api/transactions?account=${SAVINGS}&from=2026-10-08&to=2026-10-08`);
    const { transactions } = await res.json();
    expect(transactions.filter((t: { description: string }) => t.description.startsWith("Transfer to Meera Nair"))).toHaveLength(1);
  });

  test("Confirm is disabled while the transfer is being sent", async ({ page, transfer }) => {
    await page.route("**/api/transfers", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await transfer.startReview({ to: "Ravi Iyer", amount: "10.00" });
    await transfer.confirm.click();
    await expect(transfer.confirm).toBeDisabled();
    await expect(transfer.success).toBeVisible();
  });
});
