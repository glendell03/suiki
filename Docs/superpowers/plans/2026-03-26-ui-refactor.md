# Suiki UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Total UI refactor to achieve an iOS 26 Liquid Glass aesthetic with Framer Motion animations, floating icon-only nav, 2×2 feature grid home, circular stamp display, and redesigned QR screen.

**Architecture:** Pure UI layer changes — no logic, hooks, types, or blockchain code is touched. New design tokens are defined in `globals.css` as CSS custom properties. Two new components (`WalletDropdown`, `FeatureGrid`) are added. Existing components are refactored in-place following the same file structure.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Framer Motion v12, lucide-react v1, `beautiful-qr-code`, `next/font/google`

**Spec:** `docs/superpowers/specs/2026-03-26-ui-refactor-design.md`

**Testing note:** Component tests (`.test.tsx`) are disabled pending jsdom setup. Run `pnpm test` (lib tests only) after each task to confirm nothing is broken. Visual verification in `pnpm dev` is the primary QA for UI tasks.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/globals.css` | Add liquid glass tokens, update glass-card, remove tap-target |
| Modify | `src/app/layout.tsx` | Add Plus Jakarta Sans display font |
| Modify | `next.config.ts` | Add viewTransition, widen img-src CSP |
| Modify | `src/components/page-shell.tsx` | Update pb-nav for floating nav height |
| Create | `src/components/wallet-dropdown.tsx` | Avatar icon + animated dropdown |
| Modify | `src/app/site-header.tsx` | Wire WalletDropdown |
| Rebuild | `src/components/bottom-nav.tsx` | Floating liquid glass pill, icons only |
| Create | `src/components/feature-grid.tsx` | 2×2 home page feature tiles |
| Rebuild | `src/components/stamp-grid.tsx` | Circular bordered slots with gift icon |
| Modify | `src/components/merchant-card.tsx` | Raw img logo, Framer Motion expand |
| Modify | `src/app/customer/page.tsx` | Greeting + 2×2 grid + staggered card list |
| Modify | `src/app/customer/cards/page.tsx` | New StampGrid integration |
| Modify | `src/app/customer/cards/[cardId]/page.tsx` | Wire BeautifulQR, raw img |
| Rebuild | `src/app/customer/scan/page.tsx` | Gradient bg + white floating QR card |
| Modify | `src/app/merchant/page.tsx` | Apply liquid tokens, raw img |
| Modify | `src/app/merchant/[programId]/page.tsx` | Apply liquid tokens, raw img |

---

## Task 1: Design Tokens — globals.css + Layout Font + CSP

**Goal:** Lay the foundation everything else depends on before touching any component.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Add Plus Jakarta Sans to layout.tsx**

Open `src/app/layout.tsx`. Add the display font alongside the existing Geist fonts:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// ... keep existing metadata/viewport exports unchanged ...

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-[--color-bg-base]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add liquid glass tokens and display font to globals.css**

In `src/app/globals.css`, inside the `:root { }` block, add after the existing `--nav-bg` token:

```css
  /* --- Display font --- */
  /** Plus Jakarta Sans — used for hero headings and display text. */
  --font-display: var(--font-display), ui-sans-serif, system-ui, sans-serif;

  /* --- iOS 26 Liquid Glass tokens --- */

  /** Floating nav and dropdown background — more saturated than glass-card. */
  --liquid-bg: rgba(16, 52, 33, 0.55);

  /** Luminous border — thin white edge simulates glass refraction. */
  --liquid-border: rgba(255, 255, 255, 0.1);

  /** Inset highlight — top-edge glow that makes surfaces feel convex. */
  --liquid-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.1);

  /** Liquid blur — stronger than glass-card, with saturation boost. */
  --liquid-blur: 32px;
  --liquid-saturate: 1.8;

  /** Liquid shadow — deep directional shadow + inset highlight combined. */
  --liquid-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.08) inset;
```

- [ ] **Step 3: Add `.liquid-surface` class and update `.glass-card` in globals.css**

After the existing `.glass-card` block, add:

```css
/**
 * Liquid Glass surface — iOS 26 style floating material.
 * Used for: floating bottom nav, wallet dropdown.
 * More vibrancy than .glass-card. Requires a dark background beneath.
 */
.liquid-surface {
  background: var(--liquid-bg);
  backdrop-filter: blur(var(--liquid-blur)) saturate(var(--liquid-saturate));
  -webkit-backdrop-filter: blur(var(--liquid-blur)) saturate(var(--liquid-saturate));
  border: 1px solid var(--liquid-border);
  box-shadow: var(--liquid-shadow);
}
```

Update the existing `.glass-card` block to increase blur and add highlight:

```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-card);
}
```

- [ ] **Step 4: Deprecate `.tap-target` in globals.css**

Replace the existing `.tap-target` block with a deprecation comment (keep `touch-action` only — Framer Motion handles scale):

```css
/**
 * tap-target — DEPRECATED in Sprint 4 UI refactor.
 * Press scale is now handled by Framer Motion whileTap={{ scale: 0.96 }}.
 * Only touch-action: manipulation remains for the 300ms tap-delay elimination.
 */
.tap-target {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
```

Remove the `.tap-target:active { transform: scale(...) }` rule entirely.

Also update the `@media (prefers-reduced-motion)` block — remove the `.tap-target:active` rule since it no longer applies.

- [ ] **Step 5: Add display font to `@theme` in globals.css**

Inside the existing `@theme inline { }` block, add:

```css
  --font-display: var(--font-display);
```

- [ ] **Step 6: Update `next.config.ts` — viewTransition + img-src CSP**

Open `next.config.ts`. Make two changes:

**Change 1** — widen `img-src` to allow any merchant image URL. Find:
```ts
"img-src 'self' data: blob:",
```
Replace with:
```ts
"img-src * data: blob:",
```

**Change 2** — add `viewTransition` experimental flag. In the `withPWA({...})` export, add:
```ts
experimental: {
  viewTransition: true,
},
```

Full updated export block:
```ts
export default withPWA({
  reactStrictMode: true,
  experimental: {
    viewTransition: true,
  },
  ...(isDev && {
    allowedDevOrigins: ["*.trycloudflare.com"],
  }),
  turbopack: {},
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
});
```

- [ ] **Step 7: Verify lib tests still pass**

```bash
pnpm test
```

Expected: all existing lib tests pass (no UI code was touched yet).

- [ ] **Step 8: Start dev server and visually verify font loads**

```bash
pnpm dev
```

Open `http://localhost:3000`. Check browser DevTools → Network → Fonts. Confirm `plus-jakarta-sans` appears. No visual change is expected yet (font variable is defined but not applied to elements).

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx next.config.ts
git commit -m "feat(design): add liquid glass tokens, Plus Jakarta Sans, widen img-src CSP"
```

---

## Task 2: Floating Bottom Nav

**Goal:** Replace the current edge-pinned nav with a floating liquid glass pill — icons only, Scan = green pill.

**Files:**
- Rebuild: `src/components/bottom-nav.tsx`
- Modify: `src/components/page-shell.tsx`

- [ ] **Step 1: Read the current bottom-nav.tsx and page-shell.tsx**

Read both files to understand current structure before rewriting.

`src/components/bottom-nav.tsx` — current: fixed bottom bar with 4 tab links, icon + label each.
`src/components/page-shell.tsx` — current: wraps page content, applies `.pb-nav`.

- [ ] **Step 2: Rebuild bottom-nav.tsx**

Replace the entire file content:

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, CreditCard, Search, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

type NavTab = {
  href: string;
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
  exactMatch?: boolean;
};

const NAV_TABS: NavTab[] = [
  { href: "/customer", icon: Home, label: "Home", exactMatch: true },
  { href: "/customer/cards", icon: CreditCard, label: "Cards" },
  { href: "/customer/search", icon: Search, label: "Search" },
  { href: "/customer/scan", icon: QrCode, label: "Scan" },
];

/**
 * Floating liquid-glass bottom navigation — icons only, no labels.
 * Scan tab is rendered as a solid green pill (primary CTA).
 * Active non-scan tabs: icon turns green with a glow.
 *
 * Positioning: fixed, centered horizontally, 16px above the safe-area bottom.
 * Does NOT span the full width — it's a compact floating pill.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed z-50"
      style={{
        bottom: "max(calc(16px + env(safe-area-inset-bottom)), 28px)",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="liquid-surface flex items-center gap-1 px-4 py-2.5"
        style={{ borderRadius: "999px" }}
      >
        {NAV_TABS.map(({ href, icon: Icon, label, exactMatch }) => {
          const isActive = exactMatch
            ? pathname === href
            : pathname.startsWith(href);
          const isScan = href === "/customer/scan";

          if (isScan) {
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
              >
                <motion.div
                  whileTap={{ scale: 0.93 }}
                  className="flex items-center justify-center"
                  style={{
                    background: "#4ade80",
                    borderRadius: "14px",
                    width: "46px",
                    height: "36px",
                    boxShadow: "0 2px 12px rgba(74,222,128,0.4), 0 1px 0 rgba(255,255,255,0.3) inset",
                  }}
                >
                  <Icon size={18} strokeWidth={2.2} style={{ color: "#052e16" }} />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex items-center justify-center"
                style={{ width: "44px", height: "36px" }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  style={{
                    color: isActive ? "#4ade80" : "rgba(255,255,255,0.35)",
                    filter: isActive
                      ? "drop-shadow(0 0 6px rgba(74,222,128,0.6))"
                      : "none",
                    transition: "color 200ms ease, filter 200ms ease",
                  }}
                />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
```

- [ ] **Step 3: Update page-shell.tsx — increase pb-nav clearance**

Read `src/components/page-shell.tsx`. Find where `.pb-nav` or `pb-nav` padding is set. Update the `--nav-height` token usage or the direct class to give 80px+ bottom clearance for the floating nav:

In `globals.css`, update the `--nav-height` token and `.pb-nav` rule:
```css
  --nav-height: 5rem; /* 80px — floating nav + gap */
```

And update `.pb-nav`:
```css
.pb-nav {
  padding-bottom: calc(var(--nav-height) + max(env(safe-area-inset-bottom), 16px));
}
```

- [ ] **Step 4: Visual verify**

```bash
pnpm dev
```

Navigate to `/customer`. Confirm:
- Floating pill appears centered near the bottom
- Not edge-spanning
- Scan icon is in a green pill
- Active Home icon is green/glowing
- Other icons are dim

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/bottom-nav.tsx src/components/page-shell.tsx src/app/globals.css
git commit -m "feat(nav): floating liquid glass pill nav, icons only, scan as green pill"
```

---

## Task 3: Wallet Dropdown + Header

**Goal:** Replace the inline address-in-circle avatar with a User icon that opens a Framer Motion dropdown showing address, balance, and disconnect.

**Files:**
- Create: `src/components/wallet-dropdown.tsx`
- Modify: `src/app/site-header.tsx`

- [ ] **Step 1: Create wallet-dropdown.tsx**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { UserRound, Copy, LogOut, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit-react";

/**
 * WalletDropdown — circular glass avatar button with animated dropdown.
 *
 * Shows a UserRound icon. On tap, slides down a panel with:
 *   - Full wallet address (truncated, copy button)
 *   - Disconnect button
 *
 * Closes on outside click or Escape key.
 */
export function WalletDropdown() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const address = account?.address ?? "";
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!account) {
    // Disconnected state — show empty circle placeholder
    return (
      <div
        className="h-8 w-8 rounded-full bg-[--color-bg-elevated] border border-[--color-border]"
        aria-label="Wallet not connected"
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Wallet menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[--color-primary]/30 bg-[--color-primary]/15"
      >
        <UserRound size={16} className="text-[--color-primary]" strokeWidth={2} />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-surface absolute right-0 top-10 z-50 w-64 rounded-2xl p-3"
            style={{ transformOrigin: "top right" }}
          >
            {/* Address row */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[--color-bg-elevated]/60 px-3 py-2.5">
              <span className="font-address truncate text-[--color-text-secondary]">
                {shortAddress}
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                aria-label="Copy wallet address"
                className="flex-shrink-0 text-[--color-text-muted] transition-colors hover:text-[--color-text-primary]"
              >
                {copied ? (
                  <Check size={14} className="text-[--color-primary]" />
                ) : (
                  <Copy size={14} />
                )}
              </motion.button>
            </div>

            {/* Divider */}
            <div className="my-2 h-px bg-[--color-border-subtle]" />

            {/* Disconnect */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { disconnect(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[--color-error] transition-colors hover:bg-[--color-error]/10"
            >
              <LogOut size={15} strokeWidth={2} />
              Disconnect wallet
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WalletDropdown;
```

- [ ] **Step 2: Update site-header.tsx**

Replace the file content:

```tsx
"use client";

import Link from "next/link";
import { Bell, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { WalletDropdown } from "@/components/wallet-dropdown";

/**
 * Slim app header — logo left, notification bell + wallet dropdown right.
 * Used by customer and merchant pages.
 */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      {/* Logo */}
      <Link
        href="/"
        aria-label="Suiki home"
        className="flex items-center gap-1.5 text-[--color-primary] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] rounded"
      >
        <Leaf size={22} strokeWidth={2} />
        <span className="text-base font-bold text-[--color-text-primary]">Suiki</span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          aria-label="Notifications"
          className="flex items-center justify-center rounded-full text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary]"
        >
          <Bell size={20} />
        </motion.button>

        <WalletDropdown />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Add WalletDropdown to components/index.ts export**

Open `src/components/index.ts`. Add:
```ts
export { WalletDropdown } from "./wallet-dropdown";
```

- [ ] **Step 4: Visual verify**

```bash
pnpm dev
```

Connect a wallet. Confirm:
- Avatar shows `UserRound` icon (not address string)
- Tapping opens dropdown with animation
- Address is shown truncated with copy button
- Copy button shows checkmark on click
- Disconnect button works
- Click outside closes dropdown

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/wallet-dropdown.tsx src/app/site-header.tsx src/components/index.ts
git commit -m "feat(header): wallet dropdown with UserRound icon, copy address, disconnect"
```

---

## Task 4: Feature Grid Component

**Goal:** Build the 2×2 home page feature tiles as a standalone component.

**Files:**
- Create: `src/components/feature-grid.tsx`

- [ ] **Step 1: Create feature-grid.tsx**

```tsx
"use client";

import Link from "next/link";
import {
  Stamp,
  CreditCard,
  Gift,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";

type FeatureTile = {
  id: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  subtitle: string;
  fromColor: string;
  toColor: string;
  borderColor: string;
  accentColor: string;
};

const FEATURES: FeatureTile[] = [
  {
    id: "scan",
    href: "/customer/scan",
    icon: Stamp,
    title: "Earn Stamps",
    subtitle: "Scan at any store",
    fromColor: "rgba(17,94,89,0.9)",
    toColor: "rgba(6,78,59,0.9)",
    borderColor: "rgba(45,212,191,0.25)",
    accentColor: "#2dd4bf",
  },
  {
    id: "cards",
    href: "/customer/cards",
    icon: CreditCard,
    title: "My Cards",
    subtitle: "View all progress",
    fromColor: "rgba(26,61,42,0.9)",
    toColor: "rgba(19,42,31,0.9)",
    borderColor: "rgba(74,222,128,0.2)",
    accentColor: "#4ade80",
  },
  {
    id: "rewards",
    href: "/customer/cards",
    icon: Gift,
    title: "Rewards",
    subtitle: "Redeem your stamps",
    fromColor: "rgba(120,53,15,0.85)",
    toColor: "rgba(69,26,3,0.85)",
    borderColor: "rgba(245,158,11,0.25)",
    accentColor: "#f59e0b",
  },
  {
    id: "lucky",
    href: "/customer/scan",
    icon: Sparkles,
    title: "Lucky Draw",
    subtitle: "Stamp holders only",
    fromColor: "rgba(136,19,55,0.85)",
    toColor: "rgba(80,7,36,0.85)",
    borderColor: "rgba(244,63,94,0.25)",
    accentColor: "#f43f5e",
  },
];

/**
 * FeatureGrid — 2×2 grid of feature shortcut tiles for the customer home page.
 *
 * Each tile is a gradient glass card with a Lucide icon, title, subtitle,
 * and an ArrowUpRight indicator. Framer Motion whileTap provides press feedback.
 *
 * Colors use inline styles (gradient values are data, not design tokens).
 */
export function FeatureGrid() {
  return (
    <div
      className="grid grid-cols-2 gap-3"
      aria-label="Feature shortcuts"
    >
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <Link key={f.id} href={f.href}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="relative flex flex-col justify-between rounded-2xl border p-4"
              style={{
                background: `linear-gradient(135deg, ${f.fromColor}, ${f.toColor})`,
                borderColor: f.borderColor,
                minHeight: "96px",
              }}
            >
              {/* Arrow top-right */}
              <ArrowUpRight
                size={14}
                className="absolute right-3 top-3 opacity-50"
                style={{ color: f.accentColor }}
              />

              {/* Icon */}
              <Icon
                size={22}
                strokeWidth={1.8}
                style={{ color: f.accentColor }}
              />

              {/* Text */}
              <div className="mt-3">
                <p className="text-sm font-bold leading-tight text-white">
                  {f.title}
                </p>
                <p
                  className="mt-0.5 text-[10px] font-medium leading-tight opacity-80"
                  style={{ color: f.accentColor }}
                >
                  {f.subtitle}
                </p>
              </div>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}

export default FeatureGrid;
```

- [ ] **Step 2: Export from index.ts**

```ts
export { FeatureGrid } from "./feature-grid";
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/feature-grid.tsx src/components/index.ts
git commit -m "feat(components): FeatureGrid 2x2 shortcut tiles with Lucide icons"
```

---

## Task 5: Stamp Grid Rebuild

**Goal:** Replace the current flat emoji/dot stamp grid with circular bordered slots. Filled = amber circle with emoji; empty = dashed circle; last slot always = green circle with Gift icon.

**Files:**
- Rebuild: `src/components/stamp-grid.tsx`

- [ ] **Step 1: Read current stamp-grid.tsx**

Note the current props interface: `totalSlots`, `filledSlots`, `stampEmoji`, `size`. Keep compatible props.

- [ ] **Step 2: Rebuild stamp-grid.tsx**

```tsx
"use client";

import { Gift } from "lucide-react";
import { motion } from "framer-motion";

interface StampGridProps {
  /** Total number of stamp slots (including the reward slot). */
  totalSlots: number;
  /** How many slots are filled. */
  filledSlots: number;
  /** Emoji shown inside filled slots. Defaults to ⭐ */
  stampEmoji?: string;
  /** Visual size — affects slot dimensions. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { slot: 36, icon: 14, text: "text-base" },
  md: { slot: 44, icon: 16, text: "text-xl" },
  lg: { slot: 52, icon: 18, text: "text-2xl" },
};

/**
 * StampGrid — circular bordered stamp slots.
 *
 * Slot types:
 *   Filled  — amber border + background, merchant emoji inside
 *   Empty   — dashed green border, transparent background
 *   Reward  — last slot always; green border + Gift icon (Lucide)
 *
 * The reward slot is always the last slot regardless of fill state.
 * Stamps animate in with a spring scale when first rendered.
 *
 * Layout: 5 columns, wraps to next row automatically.
 */
export function StampGrid({
  totalSlots,
  filledSlots,
  stampEmoji = "⭐",
  size = "md",
  className = "",
}: StampGridProps) {
  const { slot, icon, text } = SIZE_MAP[size];
  const rewardIndex = totalSlots - 1;

  return (
    <div
      className={["grid gap-2", className].filter(Boolean).join(" ")}
      style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      role="status"
      aria-label={`${filledSlots} of ${totalSlots} stamps collected`}
    >
      {Array.from({ length: totalSlots }, (_, i) => {
        const isReward = i === rewardIndex;
        const isFilled = i < filledSlots && !isReward;

        if (isReward) {
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: slot,
                height: slot,
                border: "1.5px solid rgba(74,222,128,0.4)",
                background: "rgba(74,222,128,0.08)",
              }}
              aria-label="Reward slot"
            >
              <Gift size={icon} style={{ color: "#4ade80" }} strokeWidth={1.8} />
            </motion.div>
          );
        }

        if (isFilled) {
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 500, damping: 28 }}
              className={["flex items-center justify-center rounded-full", text].join(" ")}
              style={{
                width: slot,
                height: slot,
                border: "1.5px solid rgba(245,158,11,0.5)",
                background: "rgba(245,158,11,0.12)",
              }}
              aria-label={`Stamp ${i + 1} collected`}
            >
              {stampEmoji}
            </motion.div>
          );
        }

        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: slot,
              height: slot,
              border: "1.5px dashed rgba(74,222,128,0.2)",
              background: "transparent",
            }}
            aria-label={`Stamp slot ${i + 1} empty`}
          />
        );
      })}
    </div>
  );
}

export default StampGrid;
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

The existing `stamp-grid.test.ts` tests the lib behaviour — check they still pass. If any import the component directly, update prop names if needed.

- [ ] **Step 4: Commit**

```bash
git add src/components/stamp-grid.tsx
git commit -m "feat(stamp-grid): circular bordered slots with amber fill, dashed empty, green gift reward"
```

---

## Task 6: Merchant Card Refactor

**Goal:** Add raw `<img>` logo support (falling back to `Store` icon), Framer Motion animated expand, and integrate the new StampGrid.

**Files:**
- Modify: `src/components/merchant-card.tsx`

- [ ] **Step 1: Read current merchant-card.tsx**

Note the props interface, especially `emoji`, `filledStamps`, `totalStamps`, `isExpanded`, `onToggle`, `onShowQR`.

- [ ] **Step 2: Rewrite merchant-card.tsx**

```tsx
"use client";

import { ChevronDown, ChevronUp, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "./glass-card";
import { StampGrid } from "./stamp-grid";
import { ProgressBarStamps } from "./progress-bar-stamps";
import { Button } from "./ui/button";

interface MerchantCardProps {
  merchantName: string;
  category: string;
  /** URL for the merchant logo image. Falls back to Store icon. */
  logoUrl?: string;
  /** Legacy emoji prop — used as stampEmoji if logoUrl absent. */
  emoji?: string;
  filledStamps?: number;
  totalStamps?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  stampEmoji?: string;
  onShowQR?: () => void;
  className?: string;
}

export function MerchantCard({
  merchantName,
  category,
  logoUrl,
  emoji = "🏪",
  filledStamps = 0,
  totalStamps = 9,
  isExpanded = false,
  onToggle,
  stampEmoji = "⭐",
  onShowQR,
  className = "",
}: MerchantCardProps) {
  const expandId = `merchant-detail-${merchantName.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <GlassCard padding="none" className={className}>
      {/* Collapsed header — always visible */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={expandId}
      >
        {/* Merchant logo */}
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[--color-bg-elevated] overflow-hidden"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={merchantName}
              width={40}
              height={40}
              className="h-10 w-10 object-cover"
              onError={(e) => {
                // Hide broken image, parent shows fallback via CSS
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-lg" aria-hidden="true">{emoji}</span>
          )}
        </div>

        {/* Merchant info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[--color-text-primary]">
            {merchantName}
          </p>
          <p className="truncate text-sm text-[--color-text-secondary]">
            {category}
          </p>
        </div>

        {/* Stamp count badge (collapsed only) */}
        {!isExpanded && (
          <span className="shrink-0 text-sm font-semibold text-[--color-accent-loyalty]">
            {filledStamps}/{totalStamps}
          </span>
        )}

        {/* Chevron */}
        {onToggle && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 text-[--color-text-secondary]"
          >
            <ChevronDown size={20} />
          </motion.div>
        )}
      </motion.div>

      {/* Expandable content — Framer Motion height animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={expandId}
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <StampGrid
                totalSlots={totalStamps}
                filledSlots={filledStamps}
                stampEmoji={stampEmoji}
                size="sm"
              />

              <ProgressBarStamps
                total={totalStamps}
                filled={filledStamps}
                showLabel
              />

              <div className="flex justify-end">
                <Button
                  variant="loyalty"
                  onClick={onShowQR}
                  className="rounded-full px-4 py-2 text-sm"
                >
                  Show QR
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

export default MerchantCard;
```

- [ ] **Step 3: Visual verify expand animation**

```bash
pnpm dev
```

Navigate to `/customer`. Tap a merchant card. Verify spring animation on expand/collapse. Verify chevron rotates.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant-card.tsx
git commit -m "feat(merchant-card): raw img logo, Framer Motion spring expand, new StampGrid"
```

---

## Task 7: Customer Home Page Redesign

**Goal:** Greeting with Plus Jakarta Sans, search bar, 2×2 FeatureGrid, staggered card list entrance.

**Files:**
- Modify: `src/app/customer/page.tsx`

- [ ] **Step 1: Read current customer/page.tsx**

Note the `CustomerDashboard` function, `FeatureBanners` function, and data flow.

- [ ] **Step 2: Rewrite customer/page.tsx**

Replace the entire file:

```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { MerchantCard } from "@/components/merchant-card";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { FeatureGrid } from "@/components/feature-grid";
import { SiteHeader } from "@/app/site-header";
import { useMyCards } from "@/hooks/use-my-cards";
import { useSponsoredTx } from "@/hooks/use-sponsored-tx";
import { buildRedeem } from "@/lib/transactions";
import type { StampCard } from "@/types/sui";

export default function CustomerPage() {
  return (
    <WalletGuard
      heading="Connect your wallet"
      description="To see your stamp cards"
    >
      <CustomerDashboard />
    </WalletGuard>
  );
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } },
};

function CustomerDashboard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const { data: cards, isLoading, error } = useMyCards();
  const { executeSponsoredTx, isPending: isRedeemPending, error: redeemError } = useSponsoredTx();

  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isRedeemingRef = useRef(false);

  const handleRedeem = async (card: StampCard) => {
    if (!account || isRedeemingRef.current) return;
    isRedeemingRef.current = true;
    setRedeemingCardId(card.objectId);
    try {
      await executeSponsoredTx(
        buildRedeem(account.address, card.programId, card.objectId),
      );
      await queryClient.invalidateQueries({ queryKey: ["cards", account.address] });
    } finally {
      isRedeemingRef.current = false;
      setRedeemingCardId(null);
    }
  };

  const handleToggle = (cardId: string) => {
    setExpandedCardId((prev) => (prev === cardId ? null : cardId));
  };

  const sortedCards = [...(cards ?? [])].sort((a, b) => {
    const aP = (a.currentStamps ?? 0) / Math.max(a.stampsRequired ?? 1, 1);
    const bP = (b.currentStamps ?? 0) / Math.max(b.stampsRequired ?? 1, 1);
    return bP - aP;
  });

  const filteredCards = searchQuery
    ? sortedCards.filter((c) =>
        c.merchantName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sortedCards;

  // Derive short display name from address
  const shortName = account?.address
    ? account.address.slice(0, 6)
    : "there";

  return (
    <div className="page-gradient flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="flex-1 overflow-y-auto pb-nav px-5 pt-1">
        {/* Greeting */}
        <section className="mb-5">
          <h1
            className="text-[28px] font-extrabold tracking-tight text-[--color-text-primary] leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Hey,{" "}
            <span className="text-[--color-primary]">{shortName}!</span>
          </h1>
          <p className="mt-1 text-sm text-[--color-text-secondary]">
            Let&apos;s earn more stamps today
          </p>
        </section>

        {/* Search */}
        <div className="mb-5">
          <SearchBar
            placeholder="Search your cards..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        {/* Feature grid */}
        <div className="mb-6">
          <FeatureGrid />
        </div>

        {/* Redeem error */}
        {redeemError && (
          <div className="mb-4 rounded-xl border border-[--color-error]/30 bg-[--color-error]/10 px-4 py-3">
            <p className="text-sm text-[--color-error]">{redeemError.message}</p>
          </div>
        )}

        {/* My Cards header */}
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-base font-bold text-[--color-text-primary]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            My Cards
          </h2>
          <Link
            href="/customer/cards"
            className="text-xs font-medium text-[--color-primary] hover:opacity-80"
          >
            View all →
          </Link>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading stamp cards">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[72px] animate-pulse rounded-2xl border border-[--color-border] bg-[--color-bg-surface]"
                aria-hidden="true"
              />
            ))}
          </ul>
        )}

        {/* Fetch error */}
        {!isLoading && error && (
          <p className="text-center text-sm text-[--color-error]">{error.message}</p>
        )}

        {/* Empty state */}
        {!isLoading && !error && cards?.length === 0 && (
          <EmptyState
            icon={Store}
            title="No stamp cards yet"
            description="Visit a merchant and scan their QR code to start collecting stamps."
            action={{
              label: "Scan a merchant QR",
              onClick: () => router.push("/customer/scan"),
            }}
          />
        )}

        {/* Card list with stagger entrance */}
        {!isLoading && !error && filteredCards.length > 0 && (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {filteredCards.map((card) => (
              <motion.li key={card.objectId} variants={itemVariants}>
                <MerchantCard
                  merchantName={card.merchantName}
                  category="Loyalty Card"
                  logoUrl={card.merchantLogo}
                  filledStamps={card.currentStamps ?? 0}
                  totalStamps={card.stampsRequired ?? 9}
                  isExpanded={expandedCardId === card.objectId}
                  onToggle={() => handleToggle(card.objectId)}
                  onShowQR={() => {
                    if (account) void handleRedeem(card);
                  }}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Visual verify**

```bash
pnpm dev
```

Confirm:
- Bold greeting with Plus Jakarta Sans
- 2×2 feature grid visible
- Cards stagger in on page load
- Search filters work

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/page.tsx
git commit -m "feat(home): Plus Jakarta Sans greeting, 2x2 FeatureGrid, staggered card entrance"
```

---

## Task 8: Cards Page — New StampGrid Integration

**Goal:** Wire the rebuilt `StampGrid` into the cards page accordion. Minor visual cleanup.

**Files:**
- Modify: `src/app/customer/cards/page.tsx`

- [ ] **Step 1: Read current cards/page.tsx**

Note the `CardAccordionRow` function — it currently uses inline stamp display logic.

- [ ] **Step 2: Update cards/page.tsx**

The `CardAccordionRow` already imports `StampGrid` — but the rebuilt `StampGrid` has a new prop signature (`totalSlots`/`filledSlots` not `total`/`filled`). Verify prop names match. Also:
- Replace `<img>` inside the avatar with a raw `<img>` (already using `src=` directly — good, just confirm no `next/image` import)
- Add `logoUrl` fallback to `Store` icon
- Wrap the accordion button with `motion.div whileTap`

Key change in `CardAccordionRow`:

```tsx
// Replace the existing logo/avatar block:
<div
  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[--color-bg-elevated] overflow-hidden"
  aria-hidden="true"
>
  {card.merchantLogo ? (
    <img
      src={card.merchantLogo}
      alt={card.merchantName}
      className="h-11 w-11 rounded-2xl object-cover"
    />
  ) : (
    <Store size={20} className="text-[--color-text-muted]" />
  )}
</div>
```

And update the `StampGrid` call to use the new prop names:
```tsx
<StampGrid
  totalSlots={card.stampsRequired}
  filledSlots={card.currentStamps}
  size="sm"
/>
```

- [ ] **Step 3: Visual verify**

Cards page shows circular stamp grid when expanded. Logo falls back to Store icon when no URL.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add src/app/customer/cards/page.tsx
git commit -m "feat(cards-page): integrate new circular StampGrid, raw img logo with Store fallback"
```

---

## Task 9: Card Detail Page — Wire BeautifulQR

**Goal:** Replace the old `QrCode` (qrcode.react) with `BeautifulQR`, use raw `<img>` for logo.

**Files:**
- Modify: `src/app/customer/cards/[cardId]/page.tsx`

- [ ] **Step 1: Read current card detail page**

Note the `TODO` comment at line 28-29 and the QR section at ~line 168.

- [ ] **Step 2: Swap QrCode for BeautifulQR**

Replace:
```tsx
import QrCode from '@/components/qr-code';
// TODO: Import BeautifulQR ...
```
With:
```tsx
import { BeautifulQR } from '@/components/beautiful-qr';
```

Replace the QR render block:
```tsx
<div className="flex justify-center rounded-xl bg-white p-4">
  <QrCode
    data={qrValue}
    size={240}
    label={`${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
  />
</div>
```
With:
```tsx
<div className="flex justify-center rounded-2xl bg-white p-5">
  <BeautifulQR
    value={qrValue}
    size={240}
    foregroundColor="#111111"
    backgroundColor="#ffffff"
  />
</div>
```

**Note:** `BeautifulQR` currently doesn't accept `foregroundColor`/`backgroundColor` as props — check `src/components/beautiful-qr.tsx`. If not, add those props to `BeautifulQRProps` and pass them to `QRCodeStyling`:

```tsx
interface BeautifulQRProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
  foregroundColor?: string;  // add
  backgroundColor?: string;  // add
}

// In the QRCodeStyling constructor:
const qr = new QRCodeStyling({
  data: value,
  type: "svg",
  typeNumber: 0,
  errorCorrectionLevel: "M",
  mode: "Byte",
  radius: 0.7,
  padding: 0,
  foregroundColor: foregroundColor ?? "#4ade80",
  backgroundColor: backgroundColor ?? "#0a1a14",
  hasLogo: false,
});
```

- [ ] **Step 3: Fix merchant logo to use raw img**

Replace the `<img>` block (it already uses raw `<img>` — confirm no `next/image` import):
```tsx
{card.merchantLogo ? (
  <img
    src={card.merchantLogo}
    alt={card.merchantName}
    width={48}
    height={48}
    className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
  />
) : (
  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[--color-bg-elevated] text-2xl" aria-hidden="true">
    🏪
  </span>
)}
```

- [ ] **Step 4: Visual verify**

Navigate to a card detail. Confirm:
- QR code renders with dark dots on white background
- Logo loads or shows emoji fallback

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/customer/cards/[cardId]/page.tsx src/components/beautiful-qr.tsx
git commit -m "feat(card-detail): wire BeautifulQR with white bg, add foregroundColor/backgroundColor props"
```

---

## Task 10: Scan Page — Full Redesign

**Goal:** Green gradient full-screen background with white floating QR card (matching reference photo).

**Files:**
- Rebuild: `src/app/customer/scan/page.tsx`

- [ ] **Step 1: Rewrite scan/page.tsx**

```tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { WalletGuard } from "@/components/wallet-guard";
import { BottomNav } from "@/components/bottom-nav";
import { BeautifulQR } from "@/components/beautiful-qr";
import { encodeCustomerCardQR } from "@/lib/qr-utils";

export default function ScanPage() {
  return (
    <WalletGuard
      heading="Connect wallet"
      description="To display your QR code"
    >
      <ScanContent />
    </WalletGuard>
  );
}

function ScanContent() {
  const account = useCurrentAccount();
  const qrValue = account
    ? encodeCustomerCardQR("default", account.address)
    : "";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background: "linear-gradient(160deg, #0a3d20 0%, #0a2a18 50%, #061a10 100%)",
      }}
    >
      {/* Back navigation */}
      <div className="px-5 pt-safe pt-4">
        <Link href="/customer">
          <motion.div
            whileTap={{ scale: 0.93 }}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronLeft size={20} className="text-white" strokeWidth={2} />
          </motion.div>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-nav">
        {/* Heading */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Show QR Code
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            Please show this to the cashier
          </p>
        </div>

        {/* White floating QR card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
          className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6"
          style={{
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {qrValue ? (
            <Suspense
              fallback={
                <div className="h-64 w-64 animate-pulse rounded-2xl bg-gray-100" />
              }
            >
              <BeautifulQR
                value={qrValue}
                size={256}
                foregroundColor="#111111"
                backgroundColor="#ffffff"
              />
            </Suspense>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-gray-100">
              <p className="text-sm text-gray-400">Connect wallet first</p>
            </div>
          )}
        </motion.div>

        {/* Wallet address */}
        {account && (
          <p className="max-w-xs text-center font-mono text-xs text-white/40">
            {account.address.slice(0, 12)}…{account.address.slice(-8)}
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Visual verify**

Navigate to `/customer/scan`. Confirm:
- Full green gradient background
- White floating card with dark QR dots
- Card animates in with spring
- Back arrow visible top-left
- Wallet address shown below card

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/customer/scan/page.tsx
git commit -m "feat(scan): green gradient bg, white floating QR card with spring entrance"
```

---

## Task 11: Merchant Pages — Token Cleanup

**Goal:** Apply liquid glass tokens to merchant pages and switch any `next/image` to raw `<img>`.

**Files:**
- Modify: `src/app/merchant/page.tsx`
- Modify: `src/app/merchant/[programId]/page.tsx`

- [ ] **Step 1: Read both merchant page files**

Check for any `import Image from "next/image"` — replace with raw `<img>`. Check for any raw hex values that should use design tokens. No structural changes needed.

- [ ] **Step 2: Replace next/image with raw img in merchant pages**

For each occurrence of `<Image ... />` from `next/image`:
```tsx
// Before:
import Image from "next/image";
<Image src={url} alt="..." width={48} height={48} className="..." />

// After (remove the import, use raw img):
<img src={url} alt="..." width={48} height={48} className="..." />
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/merchant/page.tsx src/app/merchant/[programId]/page.tsx
git commit -m "fix(merchant): replace next/image with raw img for unrestricted merchant logo URLs"
```

---

## Task 12: Final QA Pass

**Goal:** Walk through all pages and verify the refactor is complete and consistent.

- [ ] **Step 1: Full visual walkthrough**

```bash
pnpm dev
```

Checklist:
- [ ] `/customer` — greeting in Plus Jakarta Sans, 2×2 grid, stagger entrance, floating pill nav
- [ ] `/customer/cards` — accordion with circular stamp grid, merchant logos (img or Store fallback)
- [ ] `/customer/cards/[cardId]` — BeautifulQR with dark dots on white, back nav works
- [ ] `/customer/scan` — green gradient, white floating QR card, spring animation
- [ ] Header — UserRound icon avatar, dropdown opens/closes, copy and disconnect work
- [ ] Bottom nav — floating pill, icons only, Scan = green pill, active icon glows
- [ ] `/merchant` — consistent glass tokens, no broken images
- [ ] Tap all interactive elements — spring scale feedback feels right

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

All tests pass.

- [ ] **Step 3: Production build check**

```bash
pnpm build
```

No TypeScript errors. No build failures.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: UI refactor complete — liquid glass theme, floating nav, circular stamps, white QR"
```
