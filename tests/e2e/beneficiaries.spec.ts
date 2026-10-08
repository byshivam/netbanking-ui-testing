import { expect, test } from "../fixtures";

test.describe("Beneficiaries", { tag: "@e2e" }, () => {
  test.beforeEach(async ({ loggedIn, beneficiaries }) => {
    await beneficiaries.goto();
  });

  test("lists the saved beneficiaries", async ({ beneficiaries }) => {
    await expect(beneficiaries.rows).toHaveCount(2);
    await expect(beneficiaries.row("Ravi Iyer")).toContainText("ACC-200311");
    await expect(beneficiaries.row("Meera Nair")).toContainText("ARYB0000007");
  });

  test("add a beneficiary using the labelled form, then pay them", async ({ beneficiaries, transfer }) => {
    await beneficiaries.name.fill("Kabir Sethi");
    await beneficiaries.account.fill("acc-300415"); // lower case is normalised
    await beneficiaries.ifsc.fill("aryb0000012");
    await beneficiaries.add.click();

    await expect(beneficiaries.status).toHaveText("Kabir Sethi was added.");
    await expect(beneficiaries.row("Kabir Sethi")).toContainText("ACC-300415");
    await expect(beneficiaries.row("Kabir Sethi")).toContainText("ARYB0000012");
    await expect(beneficiaries.name).toHaveValue("");

    await transfer.goto();
    await expect(transfer.to.locator("option", { hasText: "Kabir Sethi · ACC-300415" })).toBeAttached();
  });

  test("invalid account number and IFSC are flagged on the right fields", async ({ beneficiaries }) => {
    await beneficiaries.name.fill("Kabir Sethi");
    await beneficiaries.account.fill("123456");
    await beneficiaries.ifsc.fill("ARYB12");
    await beneficiaries.add.click();
    await expect(beneficiaries.error("account")).toHaveText("Account number looks like ACC-123456.");
    await expect(beneficiaries.error("ifsc")).toHaveText("IFSC is 11 characters, like ARYB0000004.");
    await expect(beneficiaries.account).toHaveAttribute("aria-invalid", "true");
    await expect(beneficiaries.account).toBeFocused();
    await expect(beneficiaries.rows).toHaveCount(2);
  });

  test("an existing beneficiary can't be added twice", async ({ beneficiaries }) => {
    await beneficiaries.name.fill("Ravi Iyer");
    await beneficiaries.account.fill("ACC-200311");
    await beneficiaries.ifsc.fill("ARYB0000004");
    await beneficiaries.add.click();
    await expect(beneficiaries.error("account")).toHaveText("This account is already a beneficiary.");
  });

  test("remove a beneficiary", async ({ beneficiaries }) => {
    await beneficiaries.remove("Meera Nair").click();
    await expect(beneficiaries.status).toHaveText("Meera Nair was removed.");
    await expect(beneficiaries.rows).toHaveCount(1);
    await expect(beneficiaries.row("Meera Nair")).toHaveCount(0);
  });

  test("Pay opens the transfer page with that beneficiary chosen", async ({ page, transfer }) => {
    await page.getByRole("link", { name: "Pay Meera Nair" }).click();
    await expect(page).toHaveURL(/\/transfer\?to=BEN-2$/);
    await expect(transfer.to).toHaveValue("BEN-2");
  });
});
