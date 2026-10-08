// Page Objects. Locators are role- and label-based (what a user or screen reader
// sees), so an unlabelled control fails the test instead of being clicked by CSS id.
import { expect, type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly customerId: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly toggle: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.customerId = page.getByLabel("Customer ID");
    this.password = page.getByLabel("Password", { exact: true });
    this.submit = page.getByRole("button", { name: "Log in" });
    this.toggle = page.getByRole("button", { name: /(show|hide) password/i });
    this.error = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(customerId: string, password: string) {
    await this.customerId.fill(customerId);
    await this.password.fill(password);
    await this.submit.click();
  }
}

export class Header {
  readonly logout: Locator;
  readonly name: Locator;

  constructor(readonly page: Page) {
    this.logout = page.getByRole("button", { name: "Log out" });
    this.name = page.getByTestId("customer-name");
  }

  link(name: string) {
    return this.page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });
  }
}

export class DashboardPage {
  readonly header: Header;
  readonly greeting: Locator;
  readonly recentRows: Locator;

  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.greeting = page.getByRole("heading", { level: 1 });
    this.recentRows = page.locator("#recent tbody tr");
  }

  async goto() {
    await this.page.goto("/dashboard");
    await expect(this.page.locator(".account").first()).toBeVisible();
  }

  card(accountNumber: string) {
    return this.page.locator(`[data-account="${accountNumber}"]`);
  }

  balance(accountNumber: string) {
    return this.card(accountNumber).getByTestId("balance");
  }

  quickAction(name: string) {
    return this.page.locator("#quick-actions").getByRole("link", { name });
  }
}

export interface TransferDetails {
  from?: string;
  to: string;
  amount: string;
  remarks?: string;
}

export class TransferPage {
  readonly from: Locator;
  readonly to: Locator;
  readonly amount: Locator;
  readonly remarks: Locator;
  readonly review: Locator;
  readonly confirm: Locator;
  readonly edit: Locator;
  readonly reviewAmount: Locator;
  readonly success: Locator;
  readonly successText: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.from = page.getByLabel("Pay from");
    this.to = page.getByLabel("Pay to");
    this.amount = page.getByLabel("Amount (₹)");
    this.remarks = page.getByLabel(/^Remarks/);
    this.review = page.getByRole("button", { name: "Review transfer" });
    this.confirm = page.getByRole("button", { name: "Confirm transfer" });
    this.edit = page.getByRole("button", { name: "Edit" });
    this.reviewAmount = page.locator("#review-amount");
    this.success = page.getByRole("heading", { name: "Transfer successful" });
    this.successText = page.locator("#done-text");
    this.error = page.getByRole("alert");
  }

  async goto(query = "") {
    await this.page.goto(`/transfer${query}`);
    await expect(this.from.locator("option").first()).toBeAttached();
  }

  async fill({ from, to, amount, remarks }: TransferDetails) {
    if (from) await this.from.selectOption({ value: from });
    const value = await this.to.locator("option", { hasText: to }).first().getAttribute("value");
    await this.to.selectOption({ value: value ?? "" });
    await this.amount.fill(amount);
    if (remarks) await this.remarks.fill(remarks);
  }

  async startReview(details: TransferDetails) {
    await this.fill(details);
    await this.review.click();
    await expect(this.reviewAmount).toBeVisible();
  }

  fieldError(field: "amount" | "beneficiary") {
    return this.page.locator(`#${field}-error`);
  }
}

export class BeneficiariesPage {
  readonly name: Locator;
  readonly account: Locator;
  readonly ifsc: Locator;
  readonly add: Locator;
  readonly rows: Locator;
  readonly status: Locator;

  constructor(readonly page: Page) {
    this.name = page.getByLabel("Account holder name");
    this.account = page.getByLabel("Account number");
    this.ifsc = page.getByLabel("IFSC");
    this.add = page.getByRole("button", { name: "Add beneficiary" });
    this.rows = page.locator("#list tbody tr");
    this.status = page.locator("#status");
  }

  async goto() {
    await this.page.goto("/beneficiaries");
    await expect(this.rows.first()).toBeVisible();
  }

  row(name: string) {
    return this.rows.filter({ hasText: name });
  }

  remove(name: string) {
    return this.page.getByRole("button", { name: `Remove ${name}` });
  }

  error(field: "name" | "account" | "ifsc") {
    return this.page.locator(`#ben-${field}-error`);
  }
}

export class StatementPage {
  readonly account: Locator;
  readonly from: Locator;
  readonly to: Locator;
  readonly show: Locator;
  readonly rows: Locator;
  readonly totalDebits: Locator;
  readonly totalCredits: Locator;
  readonly count: Locator;
  readonly empty: Locator;
  readonly rangeError: Locator;

  constructor(readonly page: Page) {
    this.account = page.getByLabel("Account", { exact: true });
    this.from = page.getByLabel("From", { exact: true });
    this.to = page.getByLabel("To", { exact: true });
    this.show = page.getByRole("button", { name: "Show" });
    this.rows = page.locator("#result tbody tr");
    this.totalDebits = page.getByTestId("total-debits");
    this.totalCredits = page.getByTestId("total-credits");
    this.count = page.getByTestId("row-count");
    this.empty = page.getByText("No transactions in this period.");
    this.rangeError = page.locator("#range-error");
  }

  async goto() {
    await this.page.goto("/statement");
    await expect(this.count.or(this.empty)).toBeVisible();
  }

  async filter(account: string, from: string, to: string) {
    await this.account.selectOption({ value: account });
    await this.from.fill(from);
    await this.to.fill(to);
    await this.show.click();
  }
}
