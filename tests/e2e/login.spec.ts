import { expect, test } from "../fixtures";

test.describe("Login and session", { tag: "@e2e" }, () => {
  test("valid login lands on the dashboard with the customer's name", async ({ page, loginPage, customer }) => {
    await loginPage.goto();
    await loginPage.login(customer.customerId, customer.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome, Asha" })).toBeVisible();
  });

  test("customer ID is not case sensitive", async ({ page, loginPage, customer }) => {
    await loginPage.goto();
    await loginPage.login(customer.customerId.toLowerCase(), customer.password);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("wrong password shows an error with attempts left", async ({ page, loginPage, customer }) => {
    await loginPage.goto();
    await loginPage.login(customer.customerId, "wrong-password");
    await expect(loginPage.error).toHaveText(/incorrect.*2 attempts left/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("third wrong password locks the login, even for the right password after", async ({ loginPage, customer }) => {
    await loginPage.goto();
    for (const left of ["2 attempts", "1 attempt"]) {
      await loginPage.login(customer.customerId, "wrong-password");
      await expect(loginPage.error).toContainText(left);
    }
    await loginPage.login(customer.customerId, "wrong-password");
    await expect(loginPage.error).toHaveText(/locked/);
    await loginPage.login(customer.customerId, customer.password);
    await expect(loginPage.error).toHaveText(/locked/);
  });

  test("empty form is rejected before calling the server", async ({ page, loginPage }) => {
    let calls = 0;
    await page.route("**/api/login", (route) => {
      calls += 1;
      return route.continue();
    });
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(loginPage.error).toHaveText("Enter your Customer ID and password.");
    expect(calls).toBe(0);
  });

  test("show/hide password toggles the field and its label", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.password.fill("Secret@1");
    await expect(loginPage.password).toHaveAttribute("type", "password");
    await loginPage.toggle.click();
    await expect(loginPage.password).toHaveAttribute("type", "text");
    await expect(loginPage.toggle).toHaveAccessibleName("Hide password");
    await expect(loginPage.toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("pages behind login redirect to the login page", async ({ page }) => {
    await page.goto("/transfer");
    await expect(page).toHaveURL(/\/login\?next=%2Ftransfer$/);
  });

  test("after login the customer goes back to the page they asked for", async ({ page, loginPage, customer }) => {
    await page.goto("/statement");
    await loginPage.login(customer.customerId, customer.password);
    await expect(page).toHaveURL(/\/statement$/);
  });

  test("logout ends the session: the dashboard no longer opens", async ({ page, loggedIn, dashboard }) => {
    await dashboard.goto();
    await dashboard.header.logout.click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    const me = await page.request.get("/api/me");
    expect(me.status()).toBe(401);
  });
});
