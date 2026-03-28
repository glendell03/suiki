/**
 * Merchant Create-Program Wizard E2E tests.
 *
 * Tests the 6-step create-program flow:
 *   1. Program Name
 *   2. Logo URL
 *   3. Stamp Goal (stepper)
 *   4. Reward Description
 *   5. Theme Picker
 *   6. Review & Submit
 *
 * WalletGuard is bypassed by injecting a fake connected account via
 * injectWallet() before each page navigation.
 */

import { test, expect, type Page } from "@playwright/test";
import { injectWallet } from "./fixtures/mock-data";

/** A publicly accessible image URL that loads fast in tests. */
const LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png";

/**
 * Locate the wizard "Next →" button specifically.
 * Uses exact text to avoid matching the Next.js Dev Tools button which also
 * matches /next/i in development mode.
 */
function nextButton(page: Page) {
  // StepActions renders the button text as "Next →" (HTML &rarr; entity = →)
  return page.getByRole("button", { name: "Next →", exact: true });
}

test.describe("Merchant Create-Program Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Inject wallet BEFORE navigation so WalletGuard sees the account on mount.
    await injectWallet(page);
    await page.goto("/merchant/create");
    // Wait for the page to be interactive.
    await page.waitForLoadState("networkidle");
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────
  test("renders step 1 on load", async ({ page }) => {
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────
  test("Next button is disabled with empty name", async ({ page }) => {
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });

    await expect(nextButton(page)).toBeDisabled();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────
  test("Next button enabled after typing a valid name", async ({ page }) => {
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });

    const input = page.getByPlaceholder(/coffee bean loyalty stamps/i);
    await input.fill("My Coffee Shop");

    await expect(nextButton(page)).toBeEnabled();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────
  test("navigates from step 1 to step 2", async ({ page }) => {
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });

    // Fill name and advance.
    const input = page.getByPlaceholder(/coffee bean loyalty stamps/i);
    await input.fill("My Coffee Shop");
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // Step 2 heading should be visible.
    await expect(page.getByText(/add a logo/i)).toBeVisible({ timeout: 8_000 });
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────
  test("stamp stepper increments and decrements", async ({ page }) => {
    // Advance through step 1 → step 2 → step 3.
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByPlaceholder(/coffee bean loyalty stamps/i);
    await nameInput.fill("My Coffee Shop");
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // Step 2: fill a valid URL and wait for canProceed (isValidUrl && imgState !== 'loading').
    await expect(page.getByText(/add a logo/i)).toBeVisible({ timeout: 8_000 });
    const logoInput = page.getByPlaceholder(/https:\/\/example\.com\/logo\.png/i);
    await logoInput.fill(LOGO_URL);
    // Image must load before Next is enabled (up to 12 s).
    await expect(nextButton(page)).toBeEnabled({ timeout: 12_000 });
    await nextButton(page).click();

    // Step 3: Stamp goal stepper.
    await expect(
      page.getByText(/how many stamps to earn a reward/i)
    ).toBeVisible({ timeout: 8_000 });

    // Default stamp count is 10.
    await expect(page.getByText("10", { exact: true })).toBeVisible();

    // Increment by 1 — counter should show 11.
    await page.getByRole("button", { name: /increase stamps/i }).click();
    await expect(page.getByText("11", { exact: true })).toBeVisible();

    // Decrement twice — net result should be 9.
    await page.getByRole("button", { name: /decrease stamps/i }).click();
    await page.getByRole("button", { name: /decrease stamps/i }).click();
    await expect(page.getByText("9", { exact: true })).toBeVisible();
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────
  test("full wizard: navigates all 6 steps to Review", async ({ page }) => {
    const PROGRAM_NAME = "Full Wizard Test";
    const REWARD_TEXT = "One free coffee";

    // ── Step 1: Program Name ──
    await expect(
      page.getByText(/what.s your program called/i)
    ).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByPlaceholder(/coffee bean loyalty stamps/i);
    await nameInput.fill(PROGRAM_NAME);
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // ── Step 2: Logo URL ──
    await expect(page.getByText(/add a logo/i)).toBeVisible({ timeout: 8_000 });
    const logoInput = page.getByPlaceholder(/https:\/\/example\.com\/logo\.png/i);
    await logoInput.fill(LOGO_URL);
    await expect(nextButton(page)).toBeEnabled({ timeout: 12_000 });
    await nextButton(page).click();

    // ── Step 3: Stamp Goal ──
    await expect(
      page.getByText(/how many stamps to earn a reward/i)
    ).toBeVisible({ timeout: 8_000 });
    await nextButton(page).click();

    // ── Step 4: Reward Description ──
    await expect(page.getByText(/what do customers earn/i)).toBeVisible({
      timeout: 8_000,
    });
    const rewardInput = page.getByPlaceholder(/one free coffee/i);
    await rewardInput.fill(REWARD_TEXT);
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();

    // ── Step 5: Theme Picker ──
    await expect(page.getByText(/pick a stamp style/i)).toBeVisible({
      timeout: 8_000,
    });
    await nextButton(page).click();

    // ── Step 6: Review ──
    await expect(page.getByText(/review your program/i)).toBeVisible({
      timeout: 8_000,
    });

    // Program name should appear in the card preview.
    await expect(page.getByText(PROGRAM_NAME).first()).toBeVisible();

    // "Create Program" CTA should be present and enabled.
    const createBtn = page.getByRole("button", { name: /create program/i });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
  });
});
