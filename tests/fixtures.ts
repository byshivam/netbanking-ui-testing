// Every test gets its own fresh customer (POST /api/_test/customers), so tests
// never share balances or beneficiaries and can run in parallel in any order.
import { test as base, expect } from "@playwright/test";
import { BeneficiariesPage, DashboardPage, LoginPage, StatementPage, TransferPage } from "./pages/pages";

export interface Customer {
  customerId: string;
  password: string;
  name: string;
}

interface Fixtures {
  customer: Customer;
  loggedIn: Customer;
  loginPage: LoginPage;
  dashboard: DashboardPage;
  transfer: TransferPage;
  beneficiaries: BeneficiariesPage;
  statement: StatementPage;
}

export const test = base.extend<Fixtures>({
  customer: async ({ request }, use) => {
    const res = await request.post("/api/_test/customers", { data: { name: "Asha Verma" } });
    expect(res.status()).toBe(201);
    await use(await res.json());
  },
  // Logs in through the API: the session cookie lands in the page's browser context.
  loggedIn: async ({ page, customer }, use) => {
    const res = await page.request.post("/api/login", {
      data: { customerId: customer.customerId, password: customer.password },
    });
    expect(res.ok()).toBeTruthy();
    await use(customer);
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  transfer: async ({ page }, use) => use(new TransferPage(page)),
  beneficiaries: async ({ page }, use) => use(new BeneficiariesPage(page)),
  statement: async ({ page }, use) => use(new StatementPage(page)),
});

export { expect };

export const SAVINGS = "ACC-100201";
export const CURRENT = "ACC-100202";
