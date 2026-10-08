// Network mocking: what the customer sees when the server is slow, down or erroring.
import { SAVINGS, expect, test } from "../fixtures";

test.describe("Slow and failing network", { tag: "@network" }, () => {
  test.beforeEach(async ({ loggedIn }) => {});

  test("transfer API returns 500: error shown, no success screen, no money moves", async ({ page, transfer, dashboard }) => {
    await page.route("**/api/transfers", (route) =>
      route.fulfill({ status: 500, json: { error: { code: "SERVER_ERROR", message: "Something went wrong." } } }));
    await transfer.goto();
    await transfer.startReview({ from: SAVINGS, to: "Ravi Iyer", amount: "500.00" });
    await transfer.confirm.click();
    await expect(transfer.error).toContainText("Transfer could not be completed");
    await expect(transfer.success).toBeHidden();
    await expect(transfer.confirm).toBeEnabled(); // customer can try again

    await page.unroute("**/api/transfers");
    await dashboard.goto();
    await expect(dashboard.balance(SAVINGS)).toHaveText("₹1,25,000.50");
  });

  test("network drops during transfer: customer is told nothing was sent", async ({ page, transfer }) => {
    await page.route("**/api/transfers", (route) => route.abort("internetdisconnected"));
    await transfer.goto();
    await transfer.startReview({ to: "Ravi Iyer", amount: "500.00" });
    await transfer.confirm.click();
    await expect(transfer.error).toContainText("The network connection was lost.");
    await expect(transfer.error).toContainText("No money has left your account.");
    await expect(transfer.success).toBeHidden();
  });

  test("retry after a failure uses the same idempotency key, so the money moves once", async ({ page, transfer }) => {
    const keys: string[] = [];
    let first = true;
    await page.route("**/api/transfers", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (first) {
        first = false;
        // the server processed it but the response was lost on the way back
        await route.fetch();
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    await transfer.goto();
    await transfer.startReview({ from: SAVINGS, to: "Meera Nair", amount: "300.00" });
    await transfer.confirm.click();
    await expect(transfer.error).toBeVisible();
    await transfer.confirm.click();
    await expect(transfer.success).toBeVisible();

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    const res = await page.request.get(`/api/transactions?account=${SAVINGS}&from=2026-10-08&to=2026-10-08`);
    expect((await res.json()).transactions).toHaveLength(1);
  });

  test("slow accounts API shows a loading state, then the data", async ({ page, dashboard }) => {
    await page.route("**/api/accounts", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/dashboard");
    await expect(page.getByRole("status").filter({ hasText: "Loading your accounts" })).toBeVisible();
    await expect(dashboard.balance(SAVINGS)).toHaveText("₹1,25,000.50", { timeout: 10_000 });
  });

  test("accounts API down: error state with a working Retry", async ({ page, dashboard }) => {
    let down = true;
    await page.route("**/api/accounts", (route) =>
      down ? route.fulfill({ status: 503, body: "Service Unavailable" }) : route.continue());
    await page.goto("/dashboard");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("We couldn't load your accounts right now.");
    down = false;
    await alert.getByRole("button", { name: "Retry" }).click();
    await expect(dashboard.balance(SAVINGS)).toHaveText("₹1,25,000.50");
  });

  test("statement API fails: error with Retry instead of an empty table", async ({ page, statement }) => {
    await page.route("**/api/transactions?**", (route) => route.fulfill({ status: 500, json: {} }));
    await page.goto("/statement");
    await expect(page.getByRole("alert")).toContainText("We couldn't load this statement.");
    await expect(statement.empty).toBeHidden();
  });
});
