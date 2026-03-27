/**
 * Responsive layout E2E tests.
 *
 * Verifies no horizontal overflow, readable content, and layout integrity
 * across desktop (1440px), tablet (768px), and mobile (390px) viewports.
 * Runs against all major routes.
 */

import { test, expect } from "@playwright/test";
import { injectWallet, mockSuiRpc } from "./fixtures/mock-data";

const PUBLIC_ROUTES = ["/"];

const PROTECTED_ROUTES = [
  "/customer",
  "/customer/cards",
  "/customer/scan",
  "/customer/search",
  "/merchant",
];

/** Checks that the page has no horizontal overflow. */
async function assertNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "Page should not have horizontal scroll").toBe(false);
}

/** Checks that the viewport does not have a forced scroll bar caused by overflowing content. */
async function assertBodyFitsViewport(page: import("@playwright/test").Page) {
  const { bodyWidth, viewportWidth } = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
}

test.describe("Public routes — no horizontal overflow", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} fits viewport`, async ({ page }) => {
      await page.goto(route);
      await assertNoHorizontalScroll(page);
      await assertBodyFitsViewport(page);
    });
  }
});

test.describe("Protected routes — no horizontal overflow (mocked wallet)", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`${route} fits viewport`, async ({ page }) => {
      await page.goto(route);
      // Wait for the page content (not just the guard prompt) to appear
      await page.waitForLoadState("networkidle");
      await assertNoHorizontalScroll(page);
      await assertBodyFitsViewport(page);
    });
  }
});

test.describe("Bottom nav visibility by viewport", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
  });

  test("bottom nav is visible on mobile", async ({ page }) => {
    await page.goto("/customer");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible({ timeout: 8000 });
  });

  test("bottom nav does not cause layout overflow on mobile", async ({
    page,
  }) => {
    await page.goto("/customer");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalScroll(page);
  });
});

test.describe("Content readability checks", () => {
  test("landing page hero heading visible at all viewports", async ({
    page,
  }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();

    const { fontSize } = await h1.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { fontSize: parseFloat(style.fontSize) };
    });
    // Heading font size must be at least 20px on all viewports
    expect(fontSize).toBeGreaterThanOrEqual(20);
  });
});
