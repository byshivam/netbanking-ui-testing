// Every test gets its own fresh customer (POST /api/_test/customers), so tests
// never share balances or beneficiaries and can run in parallel in any order.
import { test as base, expect } from "@playwright/test";
import * as allure from "allure-js-commons";
import { BeneficiariesPage, DashboardPage, LoginPage, StatementPage, TransferPage } from "./pages/pages";

export interface Customer {
  customerId: string;
  password: string;
  name: string;
}

const LAYERS: Record<string, string> = {
  e2e: "End-to-end", a11y: "Accessibility", visual: "Visual regression", mobile: "Responsive", network: "Network resilience",
};
const CRITICAL = /transfer|login|logout|session|pay/i;

interface Fixtures {
  allureLabels: void;
  customer: Customer;
  loggedIn: Customer;
  loginPage: LoginPage;
  dashboard: DashboardPage;
  transfer: TransferPage;
  beneficiaries: BeneficiariesPage;
  statement: StatementPage;
}

export const test = base.extend<Fixtures>({
  // Groups every test in the Allure report: epic > feature (test layer) > story (describe block).
  allureLabels: [
    async ({}, use, testInfo) => {
      const folder = testInfo.file.split(/[\\/]tests[\\/]/)[1]?.split(/[\\/]/)[0] ?? "other";
      await allure.epic("Arya Bank NetBanking");
      await allure.feature(LAYERS[folder] ?? folder);
      await allure.story(testInfo.titlePath[testInfo.titlePath.length - 2] ?? "General");
      await allure.severity(CRITICAL.test(testInfo.title) ? "critical" : "normal");
      await use();
    },
    { auto: true },
  ],
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
