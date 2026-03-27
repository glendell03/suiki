# Suiki QA Test Plan

> **Project**: Suiki — blockchain loyalty stamp-card PWA on the Sui network
> **Stack**: Next.js 16 · React 19 · Tailwind CSS v4 · TanStack Query v5 · Vitest 4
> **Last updated**: 2026-03-26

---

## 1. Automated Test Coverage (Current)

| File | Tests | Status |
|------|-------|--------|
| `src/lib/__tests__/queries.test.ts` | Type-shape checks for StampProgram, StampCard | Passing |
| `src/lib/__tests__/qr-parsing.test.ts` | parseQRPayload — 17 cases including XSS and injection | Passing |
| `src/lib/__tests__/qr-utils-extended.test.ts` | encodeCustomerCardQR, encodeRewardClaimQR, decodeQRPayload — 30 cases | Passing |
| `src/lib/__tests__/rate-limit.test.ts` | Daily tx count, limit checks, date rollover — 16 cases | Passing |
| `src/lib/__tests__/transactions.test.ts` | Transaction builder smoke tests | Passing |
| `src/components/__tests__/glass-card.test.ts` | PADDING_CLASSES map, className assembly — 15 cases | Passing |
| `src/components/__tests__/stamp-grid.test.ts` | getStampStates logic — 25 cases | Passing |
| `src/components/__tests__/progress-bar-stamps.test.ts` | calculateStampPercentage, CSS string — 18 cases | Passing |
| `src/components/__tests__/bottom-nav.test.ts` | getActiveTab logic — 17 cases | Passing |
| `src/components/__tests__/badge.test.ts` | Variant → class mapping — 14 cases | Passing |

**Total: 180 automated tests passing.**

Component render tests (`.test.tsx`) are blocked pending jsdom setup — see
[Section 6: Known Issues](#6-known-issues--limitations) and
`Docs/qa-dependencies-needed.md`.

---

## 2. Manual Testing Checklist (By Screen)

### Customer Home (`/customer`)

- [ ] Merchant search bar is visible and has a visible label or `aria-label`
- [ ] Typing in the search bar filters the merchant card list in real time
- [ ] Clearing the search bar restores the full merchant list
- [ ] Merchant cards expand on tap to show stamp details
- [ ] Merchant cards collapse again on second tap
- [ ] Bottom navigation is visible with four tabs: Home, Cards, Search, Scan
- [ ] The Home tab shows the active indicator (green dot + primary colour)
- [ ] Tapping another tab navigates to the correct route
- [ ] Stamps collected are visible inside expanded merchant cards
- [ ] Empty state is shown when no merchants are found or no cards exist

### Cards Progress (`/customer/cards`)

- [ ] All of the customer's stamp cards are listed
- [ ] Cards are sorted correctly (e.g. most recent activity first, or by merchant name)
- [ ] Each card shows merchant name, logo (or fallback emoji), stamp count, and progress
- [ ] Progress bar or stamp grid accurately reflects `currentStamps / stampsRequired`
- [ ] Cards with rewards available show a "Redeem" call-to-action
- [ ] Expand/collapse works on individual cards if they are collapsible
- [ ] QR button (where present) opens the QR display for that card
- [ ] Cards tab shows the active indicator in the bottom navigation

### QR Display (card detail / `/customer/cards/[id]`)

- [ ] QR code renders visually within 300 ms of page load
- [ ] QR code is scannable by the merchant scanner (manual scan test)
- [ ] The label below the QR identifies the correct merchant and card
- [ ] The encoded payload begins with `v1:` (verify via browser devtools if possible)
- [ ] Rotating the phone / enlarging the QR keeps it centred and readable
- [ ] A "back" navigation mechanism is available (link or browser back gesture)

### Reward Claim

- [ ] The reward claim flow is only reachable when `currentStamps >= stampsRequired`
- [ ] A different QR is displayed for reward claim vs. regular card scan (reward type)
- [ ] The QR label clearly identifies it as a reward claim (not a stamp scan)
- [ ] Merchant QR for the relevant program is accessible from this screen
- [ ] After successful redemption, `currentStamps` resets and the UI updates

### Merchant Dashboard (`/merchant`)

- [ ] All stamp programs belonging to the merchant are listed
- [ ] Each program shows its name, stamps required, and reward description
- [ ] A QR code is available for each program (for customers to scan to get a card)
- [ ] The merchant scanner page allows the merchant to scan a customer QR
- [ ] Scanning a `card_scan` QR issues a stamp to the correct card
- [ ] Scanning a `reward_claim` QR initiates the redemption flow

---

## 3. Accessibility Audit Checklist

### Landmarks and Navigation

- [ ] Bottom nav is wrapped in a `<nav>` element with `aria-label="Main navigation"`
- [ ] The active tab link has `aria-current="page"`
- [ ] Page content is inside a `<main>` landmark
- [ ] Page shell / header uses an appropriate landmark (e.g. `<header>`)

### Stamp and Card Components

- [ ] StampGrid (when implemented) has `role="group"` and a descriptive `aria-label`
      (e.g. `aria-label="3 of 9 stamps collected"`)
- [ ] StampProgress container has `role="status"` and `aria-label` (already implemented)
- [ ] Progress bar for stamps has `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### QR Codes

- [ ] QR code images have `role="img"` and an `aria-label` that includes the encoded value
      or a human-readable description of what the QR represents
- [ ] QR codes are not the sole means of accessing functionality (fallback text action)

### Interactive Elements

- [ ] MerchantCard expand/collapse button has `aria-expanded` set to `"true"` or `"false"`
- [ ] MerchantCard expand/collapse button has `aria-controls` pointing to the collapsible panel ID
- [ ] SearchBar has a visible `<label>` or `aria-label` attribute
- [ ] All buttons have accessible names (text content or `aria-label`)
- [ ] Redeem button `aria-label` includes the merchant name
      (e.g. `"Redeem reward at Kape ni Juan"`)

### Colour and Contrast

- [ ] All body text meets WCAG AA contrast ratio of 4.5:1 on `#0a1a14` dark background
- [ ] Interactive text (links, buttons) meets 4.5:1 contrast in both default and active states
- [ ] Loyalty accent gold (`--color-accent-loyalty`) meets contrast against dark backgrounds

### Touch and Keyboard

- [ ] All interactive touch targets are at least 44 × 44 px (verified on physical device)
- [ ] Focus rings are visible on all interactive elements during keyboard navigation
- [ ] Tab order follows a logical reading order (top-to-bottom, left-to-right)
- [ ] No keyboard traps — pressing Tab always moves focus forward

### Motion

- [ ] All CSS transitions and animations are suppressed when
      `@media (prefers-reduced-motion: reduce)` is active
- [ ] Stamp card press-scale animation (`.tap-target`) is conditional on motion preference

---

## 4. PWA Testing Checklist

### Installation

- [ ] "Add to Home Screen" prompt appears on Android Chrome after returning visit
- [ ] App installs correctly as a PWA on Android Chrome
- [ ] App can be added to the home screen on iOS Safari ("Add to Home Screen" in share menu)
- [ ] Installed PWA launches in standalone mode (no browser chrome visible)
- [ ] Installed PWA displays the correct app name and icon on the home screen

### Manifest and Theme

- [ ] `manifest.webmanifest` (or `manifest.json`) is served at the correct URL
- [ ] `theme_color` in the manifest matches the header/status-bar green
- [ ] `background_color` in the manifest matches the app background (`#0a1a14`)
- [ ] Splash screen shows the correct green theme colour on both Android and iOS
- [ ] App icon is crisp at all required sizes (192 × 192, 512 × 512 minimum)

### Offline Behaviour

- [ ] With network disabled, the app shows an offline fallback page (not a blank white screen)
- [ ] Previously visited pages are served from the service worker cache when offline
- [ ] The offline page communicates clearly that the user is offline and what they can still do
- [ ] Reconnecting to the network restores full app functionality without a hard reload

### Service Worker

- [ ] Service worker is registered and active (verified in DevTools → Application → Service Workers)
- [ ] Cache is populated after first visit (verified in DevTools → Application → Cache Storage)
- [ ] A new deployment triggers the service worker update flow (users are notified or auto-refreshed)

---

## 5. Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| Lighthouse Performance score | ≥ 85 | Lighthouse (Chrome DevTools) |
| Lighthouse Accessibility score | ≥ 95 | Lighthouse |
| Lighthouse PWA score | ≥ 90 | Lighthouse |
| First Contentful Paint (FCP) | < 2 s on simulated 3G | Lighthouse / WebPageTest |
| Largest Contentful Paint (LCP) | < 2.5 s | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Total Blocking Time (TBT) | < 300 ms | Lighthouse |
| QR code renders within | 300 ms | Manual stopwatch / Performance tab |
| Time to Interactive (TTI) | < 3 s on mid-range Android | Lighthouse |

**How to run Lighthouse:**
1. Open Chrome DevTools → Lighthouse tab
2. Select "Mobile" preset, check Performance + Accessibility + PWA
3. Click "Analyze page load"
4. Record score and any failing audits

---

## 6. Cross-Device Testing Matrix

| Device | OS / Browser | Mode | Priority |
|--------|-------------|------|----------|
| iPhone 13 | iOS Safari | PWA (Add to Home Screen) | High |
| iPhone SE (2nd gen) | iOS Safari | Browser + PWA | Medium — tests small screen |
| Pixel 7 | Android 13, Chrome | PWA install | High |
| Samsung Galaxy A-series (mid-range) | Android 12, Chrome | Browser | High — target demographic |
| Desktop Chrome 1440 px | macOS / Windows | Browser | Medium — phone frame container |
| Desktop Safari | macOS | Browser | Medium |

**What to verify on each device:**
- Bottom nav tabs are tappable and correctly sized (≥ 44 × 44 px)
- Stamp grid / progress renders correctly without overflow or truncation
- QR code is large enough to scan (minimum 200 × 200 px rendered size)
- Text is legible without zooming
- No horizontal scroll on any screen
- Phone frame container (max-width 430 px) displays centred on desktop

---

## 7. Known Issues and Limitations

### jsdom Not Configured — Component Render Tests Blocked

The current Vitest config (`environment: 'node'`) does not include a DOM. As a
result, all `.test.tsx` component render tests are excluded from the test runner
and left as commented-out stubs.

**What is needed to unlock full component testing:**

1. Install dependencies:
   ```bash
   pnpm add -D @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
   ```

2. Update `vitest.config.ts` to use `jsdom` for component tests:
   ```typescript
   import react from '@vitejs/plugin-react';
   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'node',
       environmentMatchGlobs: [
         ['src/components/**/*.test.tsx', 'jsdom'],
       ],
       include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
       // ...
     },
   });
   ```

3. Uncomment `src/components/__tests__/stamp-progress.test.tsx`.

4. Convert the following `.test.ts` stubs into full `.test.tsx` render tests:
   - `src/components/__tests__/glass-card.test.ts`
   - `src/components/__tests__/stamp-grid.test.ts`
   - `src/components/__tests__/progress-bar-stamps.test.ts`
   - `src/components/__tests__/bottom-nav.test.ts`
   - `src/components/__tests__/badge.test.ts`

See `Docs/qa-dependencies-needed.md` for the full setup guide.

### QR Scan Integration Test Gap

The merchant scanner (`src/components/qr-scanner.tsx`) uses a camera-based
QR scanning library. There are currently no automated integration tests
verifying that a QR code encoded by `encodeCustomerCardQR` or
`encodeRewardClaimQR` is correctly processed end-to-end through the scanner UI.

**Recommended approach:** Use Playwright to load a QR image into the scanner's
`<video>` or canvas input and assert the decoded payload triggers the correct
handler.

### Wallet-Gated Routes

Routes behind `<WalletGuard>` redirect unauthenticated users. Automated tests
for these flows require either:
- A Sui testnet wallet connected via `@mysten/dapp-kit-react` (manual only), or
- Mocking the wallet context in unit/integration tests.

This is not currently set up. Manual testing with a testnet wallet is the only
verification method for gated flows.

### Move Contract Events

Stamp issuance and redemption events emitted by the Move contract are not
covered by automated tests. Full event-round-trip tests require either:
- A local Sui node (sui-test-validator), or
- Recorded RPC fixture responses injected via `vi.mock`.

This gap is tracked for a future sprint.
