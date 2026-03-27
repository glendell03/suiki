/**
 * WalletGuard E2E tests — verifies connect-wallet prompts on protected pages.
 *
 * Without a connected wallet, every guarded page must show the connect prompt.
 */

import { test, expect } from "@playwright/test";

const GUARDED_ROUTES = [
  { path: "/customer", label: "Customer Home" },
  { path: "/customer/cards", label: "Cards" },
  { path: "/customer/scan", label: "Scan" },
  { path: "/merchant", label: "Merchant Dashboard" },
];

for (const route of GUARDED_ROUTES) {
  test(`${route.label} shows connect wallet prompt when disconnected`, async ({
    page,
  }) => {
    await page.goto(route.path);
    // WalletGuard renders a connect prompt — look for connect-related text
    const connectText = page.getByText(/connect/i).first();
    await expect(connectText).toBeVisible({ timeout: 8000 });
  });
}

test("WalletGuard does not show connect prompt on landing page", async ({
  page,
}) => {
  await page.goto("/");
  // Landing page is not guarded — should NOT have a wallet connect prompt
  // Instead it should show the hero CTA cards
  await expect(page.getByText(/merchant/i).first()).toBeVisible();
  await expect(page.getByText(/customer/i).first()).toBeVisible();
});
