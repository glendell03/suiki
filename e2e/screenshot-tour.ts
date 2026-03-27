/**
 * Visual screenshot tour — captures every major page at Desktop, Tablet, and Mobile.
 *
 * Run: pnpm test:screenshots
 *
 * Screenshots are saved to: e2e/screenshots/<viewport>/<page>.png
 *
 * No network mocking needed — static mock data is injected via NEXT_PUBLIC_MOCK_WALLET
 * env var which makes all hooks return fixture data without any real wallet or API calls.
 */

import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const PAGES = [
  { name: "01-landing", path: "/" },
  { name: "02-customer-home", path: "/customer" },
  { name: "03-customer-cards", path: "/customer/cards" },
  { name: "04-customer-card-detail", path: "/customer/cards/0xcard0000000000000000000000000000000000000000000000000000000000a1" },
  { name: "05-customer-card-reward-ready", path: "/customer/cards/0xcard0000000000000000000000000000000000000000000000000000000000b2" },
  { name: "06-customer-scan", path: "/customer/scan" },
  { name: "07-customer-search", path: "/customer/search" },
  { name: "08-merchant-home", path: "/merchant" },
  { name: "09-merchant-create-step1", path: "/merchant/create" },
  { name: "10-merchant-program-detail", path: "/merchant/0xaaaa0000000000000000000000000000000000000000000000000000000000aa" },
];

const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "e2e", "screenshots");

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const vpDir = path.join(OUT_DIR, vp.name);
    fs.mkdirSync(vpDir, { recursive: true });

    console.log(`\n📐 Viewport: ${vp.name} (${vp.width}×${vp.height})`);

    for (const pg of PAGES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.name === "mobile" ? 2 : 1,
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const file = path.join(vpDir, `${pg.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ✅ ${pg.name}.png`);

      await context.close();
    }
  }

  await browser.close();
  console.log(`\n🎉 Screenshots saved to: e2e/screenshots/`);
})();
