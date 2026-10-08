// Layout checks that hold on every screen size, and matter most on phones.
import { expect, test } from "../fixtures";

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("Responsive layout", { tag: "@mobile" }, () => {
  for (const path of ["/dashboard", "/transfer", "/beneficiaries", "/statement"]) {
    test(`${path} has no sideways scrolling`, async ({ page, loggedIn }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page), "pixels of horizontal overflow").toBeLessThanOrEqual(0);
    });
  }

  test("login page has no sideways scrolling", async ({ page }) => {
    await page.goto("/login");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("dashboard quick actions are fully on screen", async ({ page, loggedIn, dashboard }) => {
    await dashboard.goto();
    const viewport = page.viewportSize()!;
    for (const name of ["Send money", "Manage beneficiaries", "Download statement"]) {
      const box = await dashboard.quickAction(name).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("tap targets on the transfer form are at least 44px tall", async ({ page, loggedIn, transfer }) => {
    await transfer.goto();
    for (const control of [transfer.from, transfer.to, transfer.amount, transfer.review]) {
      const box = await control.boundingBox();
      expect(Math.round(box!.height), "rendered height (px)").toBeGreaterThanOrEqual(44);
    }
  });
});
