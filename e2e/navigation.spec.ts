/**
 * Navigation E2E tests — bottom nav tabs, back buttons, routing flows.
 *
 * Injects a mock wallet so guarded pages load their content.
 */

import { test, expect } from "@playwright/test";
import { injectWallet, mockSuiRpc } from "./fixtures/mock-data";

test.describe("Bottom Navigation (Customer)", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
    await page.goto("/customer");
  });

  test("bottom nav renders with 4 tabs", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible({ timeout: 8000 });
    // Should have at least 4 nav links
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(4);
  });

  test("Scan tab navigates to /customer/scan", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: /scan/i }).click();
    await expect(page).toHaveURL(/\/customer\/scan/);
  });

  test("Cards tab navigates to /customer/cards", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: /cards/i }).click();
    await expect(page).toHaveURL(/\/customer\/cards/);
  });

  test("Explore tab navigates to /customer/search", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: /explore/i }).click();
    await expect(page).toHaveURL(/\/customer\/search/);
  });

  test("Home tab navigates back to /customer", async ({ page }) => {
    await page.goto("/customer/scan");
    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: /home/i }).click();
    await expect(page).toHaveURL(/\/customer$/);
  });
});

test.describe("Back Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
  });

  test("Card detail back button returns to /customer/cards", async ({
    page,
  }) => {
    await page.goto("/customer/cards/0xcardid111");
    const backLink = page.getByRole("link", { name: /back to cards/i });
    // If card not found, the NotFoundState shows a back link
    const notFound = page.getByText(/card not found/i);
    const isNotFound = await notFound.isVisible({ timeout: 6000 }).catch(() => false);
    if (isNotFound) {
      await backLink.click();
    } else {
      await page.getByLabel(/back to cards/i).click();
    }
    await expect(page).toHaveURL(/\/customer\/cards/);
  });
});

test.describe("Merchant Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
  });

  test("Merchant page has Create Program link", async ({ page }) => {
    await page.goto("/merchant");
    const createLink = page.getByRole("link", { name: /create/i }).first();
    await expect(createLink).toBeVisible({ timeout: 8000 });
    await expect(createLink).toHaveAttribute("href", "/merchant/create");
  });
});
