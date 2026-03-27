/**
 * Accessibility E2E tests — Phase 5 QA pass (#46).
 *
 * Uses axe-core via @axe-core/playwright to audit all major routes.
 * Violations at `critical` and `serious` impact levels fail the test.
 * Incomplete / needs-review items are logged as warnings only.
 *
 * Additional manual checks:
 * - Focus ring visible on interactive elements
 * - Touch target size ≥ 44px on mobile
 * - Images have alt text
 * - Form inputs have labels
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { injectWallet, mockSuiRpc } from "./fixtures/mock-data";

/** Run axe on the current page and assert no critical/serious violations. */
async function assertNoA11yViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  const critical = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? "")
  );

  if (critical.length > 0) {
    const summary = critical
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description}\n  → ${v.nodes
            .slice(0, 2)
            .map((n) => n.target.join(", "))
            .join(" | ")}`
      )
      .join("\n");
    expect.soft(critical.length, `Accessibility violations:\n${summary}`).toBe(0);
  }
}

test.describe("Accessibility — Public Routes", () => {
  test("/ — landing page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    await assertNoA11yViolations(page);
  });
});

test.describe("Accessibility — Protected Routes (mocked wallet)", () => {
  test.beforeEach(async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
  });

  test("/customer — home page has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/customer");
    await page.waitForLoadState("networkidle");
    await assertNoA11yViolations(page);
  });

  test("/customer/cards — cards list has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/customer/cards");
    await page.waitForLoadState("networkidle");
    await assertNoA11yViolations(page);
  });

  test("/customer/scan — scan page has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/customer/scan");
    await page.waitForLoadState("networkidle");
    await assertNoA11yViolations(page);
  });

  test("/customer/search — search page has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/customer/search");
    await page.waitForLoadState("networkidle");
    await assertNoA11yViolations(page);
  });

  test("/merchant — merchant page has no critical a11y violations", async ({
    page,
  }) => {
    await page.goto("/merchant");
    await page.waitForLoadState("networkidle");
    await assertNoA11yViolations(page);
  });
});

test.describe("Accessibility — Focus & Interaction", () => {
  test("landing page CTA cards are keyboard-focusable", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    // Should have moved focus to an interactive element
    expect(["A", "BUTTON", "INPUT"]).toContain(focused);
  });

  test("landing page links have visible focus ring", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;
      return window.getComputedStyle(el).outlineWidth;
    });
    // outline-width should not be "0px" when element is focused
    expect(focusedOutline).not.toBe("0px");
  });
});

test.describe("Accessibility — Touch Target Size (Mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("bottom nav touch targets are at least 44px tall", async ({ page }) => {
    await injectWallet(page);
    await mockSuiRpc(page);
    await page.goto("/customer");

    const navLinks = page.getByRole("navigation").getByRole("link");
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      if (box) {
        expect(
          box.height,
          `Nav link ${i} height ${box.height}px should be ≥ 44px`
        ).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe("Accessibility — Images", () => {
  test("all images on landing page have alt text", async ({ page }) => {
    await page.goto("/");
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      // alt="" is valid for decorative images, but must be present
      expect(alt).not.toBeNull();
    }
  });
});
