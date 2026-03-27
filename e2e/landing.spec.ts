/**
 * Landing page E2E tests — no wallet required.
 *
 * Covers: hero section, CTA cards, value props, responsiveness, visual tokens.
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders hero section with brand heading", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Hero should have the brand blue background
    const hero = page.locator("section").first();
    await expect(hero).toBeVisible();
  });

  test("shows Merchant and Customer CTA cards", async ({ page }) => {
    await expect(page.getByText(/merchant/i).first()).toBeVisible();
    await expect(page.getByText(/customer/i).first()).toBeVisible();
  });

  test("Merchant CTA links to /merchant", async ({ page }) => {
    const merchantLink = page.getByRole("link", { name: /merchant/i }).first();
    await expect(merchantLink).toHaveAttribute("href", "/merchant");
  });

  test("Customer CTA links to /customer", async ({ page }) => {
    const customerLink = page.getByRole("link", { name: /customer/i }).first();
    await expect(customerLink).toHaveAttribute("href", "/customer");
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 390;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance
  });

  test("page title is set", async ({ page }) => {
    await expect(page).toHaveTitle(/suiki/i);
  });

  test("watermark character visible in hero", async ({ page }) => {
    // The 水 watermark should exist in DOM (aria-hidden)
    const watermark = page.locator('[aria-hidden="true"]').filter({ hasText: "水" });
    await expect(watermark.first()).toBeAttached();
  });
});
