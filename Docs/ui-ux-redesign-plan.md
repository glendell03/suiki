# Suiki UI/UX Redesign Plan

**Date:** 2026-03-26
**Status:** Proposed
**Reference:** `Docs/design-references/` (Stampy loyalty card app mockups)
**Goal:** Transform Suiki from functional prototype to polished, app-like PWA

---

## 1. Design System Overhaul

### 1.1 Color Palette — Deep Green/Teal Theme

The reference uses a rich **deep green/teal** palette, not the current slate-blue. This creates a warmer, more premium feel aligned with loyalty/rewards psychology (green = growth, trust).

| Token | Current | New | Usage |
|-------|---------|-----|-------|
| `--color-bg-base` | `#0f172a` (slate) | `#0a1a14` (deep forest) | Page background |
| `--color-bg-surface` | `#1e293b` (slate) | `#132a1f` (dark green) | Card surfaces |
| `--color-bg-elevated` | `#334155` (slate) | `#1a3d2a` (mid green) | Modals, sheets |
| `--color-bg-glass` | — (new) | `rgba(20, 60, 40, 0.6)` | Glassmorphism cards |
| `--color-primary` | `#3b82f6` (blue) | `#4ade80` (green-400) | CTAs, active tab |
| `--color-primary-light` | `#60a5fa` | `#86efac` (green-300) | Hover/focus |
| `--color-primary-dark` | `#2563eb` | `#22c55e` (green-500) | Pressed |
| `--color-accent-loyalty` | `#f59e0b` (amber) | `#f59e0b` (keep) | Stamps, rewards |
| `--color-gradient-start` | — (new) | `#0a2e1a` | Background gradient top |
| `--color-gradient-end` | — (new) | `#0a1a14` | Background gradient bottom |
| `--color-border` | `#475569` | `rgba(74, 222, 128, 0.15)` | Green-tinted borders |
| `--color-border-subtle` | `#1e293b` | `rgba(74, 222, 128, 0.08)` | Subtle separators |

### 1.2 Glassmorphism Tokens (New)

```css
--glass-bg: rgba(20, 60, 40, 0.4);
--glass-border: rgba(74, 222, 128, 0.12);
--glass-blur: 20px;
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### 1.3 Typography

Keep **Geist Sans** (already configured via `next/font`) — it's clean, modern, and web-optimized. No need to switch to Orbitron which is too sci-fi for a loyalty app.

| Element | Size | Weight | Tracking |
|---------|------|--------|----------|
| Page title (h1) | 28px | 700 | -0.02em |
| Section heading (h2) | 20px | 600 | -0.01em |
| Card title | 16px | 600 | 0 |
| Body | 15px | 400 | 0 |
| Caption/label | 13px | 500 | 0.01em |
| Badge/tag | 12px | 600 | 0.02em |

### 1.4 Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-card` | `16px` | Cards, modals |
| `--radius-button` | `12px` | Buttons |
| `--radius-input` | `12px` | Inputs, search |
| `--radius-pill` | `9999px` | Badges, stamp dots, nav pills |
| `--spacing-page-x` | `20px` | Horizontal page padding |
| `--spacing-section-gap` | `24px` | Between sections |
| `--spacing-card-padding` | `16px` | Internal card padding |

### 1.5 Animation Tokens

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--duration-micro: 150ms;
--duration-normal: 250ms;
--duration-sheet: 350ms;
--scale-press: 0.97;
```

### 1.6 Icon System

Use **Lucide React** icons (already tree-shakeable, consistent stroke width). For merchant stamp icons, use emoji rendered as images (merchants choose their own).

---

## 2. Component Library

### 2.1 New Shared Components

| Component | Description | Priority |
|-----------|-------------|----------|
| `GlassCard` | Frosted glass container with blur backdrop, green-tinted border | P0 |
| `BottomNav` | Fixed bottom navigation (4 tabs: Home, Cards, Search, QR) | P0 |
| `StampGrid` | Grid of stamp circles (filled/empty/reward) with emoji icons | P0 |
| `MerchantCard` | Compact merchant info card (logo, name, category, expand chevron) | P0 |
| `SearchBar` | Glassmorphic search input with icon | P1 |
| `FeatureBanner` | Colorful promo card (Birthday Club, Referral, etc.) | P1 |
| `CongratulationsSheet` | Bottom sheet with ticket/voucher styling for reward claims | P1 |
| `BeautifulQR` | QR code using `beautiful-qr-code` package with Suiki branding | P0 |
| `TreatPicker` | Grid of selectable treat options (future: drag-to-select) | P2 |
| `MerchantCarousel` | Horizontal scroll of merchant discovery cards | P1 |
| `ProgressBar` | Segmented stamp progress (filled segments = stamps earned) | P0 |
| `PageShell` | Mobile-app-like page wrapper (safe areas, max-width, scroll) | P0 |
| `EmptyState` | Illustrated empty state with CTA | P1 |
| `Badge` | Small pill badge for counts, status | P1 |

### 2.2 Existing Components to Update

| Component | Changes |
|-----------|---------|
| `button.tsx` | Add `loyalty` variant (amber), add `glass` variant, add press scale animation |
| `input.tsx` | Glassmorphic styling, green-tinted focus ring |
| `stamp-card-display.tsx` | Replace with new `StampGrid` + `MerchantCard` composition |
| `stamp-progress.tsx` | Replace with segmented `ProgressBar` matching reference design |
| `qr-code.tsx` | Replace `qrcode.react` with `beautiful-qr-code` for styled QR codes |
| `site-header.tsx` | Simplify to just logo + notification bell + avatar (like reference) |
| `connect-wallet.tsx` | Style as avatar button in header, not prominent CTA |

---

## 3. Screen-by-Screen Plan

### 3.1 Customer Home (`/customer/`)

**Reference:** Screenshots 01, 03

**Layout:**
```
┌──────────────────────────┐
│  Logo    🔔   [Avatar]   │  ← Slim header
├──────────────────────────┤
│  Hey, {name}!            │  ← Personalized greeting
│  Let's earn more stamps  │
├──────────────────────────┤
│  🔍 Search merchants...  │  ← Glassmorphic search bar
├──────────────────────────┤
│  [Feature Banners Row]   │  ← Horizontal scroll: Referral, Scratch&Win etc.
├──────────────────────────┤
│  My Cards        View all│  ← Section header
│  ┌─────────────────────┐ │
│  │ ☕ Coffee Fellow     │ │  ← Expandable merchant card
│  │ ●●●●●○○○ 🎁  5/8   │ │  ← Stamp grid inline
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ 🌸 Blossom          │ │
│  │  ▸ Tap to expand    │ │
│  └─────────────────────┘ │
├──────────────────────────┤
│  New Merchants   View all│
│  [Carousel of merchants] │  ← Horizontal scroll cards with cover images
├──────────────────────────┤
│                          │
│  [Home] [Cards] [🔍] [QR]│  ← Fixed bottom nav
└──────────────────────────┘
```

**Key interactions:**
- Merchant cards expand/collapse with spring animation
- Stamp grid shows emoji stamps (merchant-configured)
- Pull-to-refresh updates card balances
- Bottom nav: active tab has green pill indicator

### 3.2 Cards Progress (`/customer/cards`)

**Reference:** Screenshot 05

**Layout:** Full-screen list of all merchant cards as accordion items.
- Each row: merchant emoji, name, category, chevron
- Expanded: stamp grid + progress bar + "Show QR" CTA
- Sort: most-progressed first

### 3.3 QR Code Display (`/customer/scan`)

**Reference:** Screenshot 02 (right screen)

**Layout:**
```
┌──────────────────────────┐
│  ←  Show QR code    ⋮   │
├──────────────────────────┤
│                          │
│     ┌──────────────┐     │
│     │              │     │
│     │  Beautiful   │     │  ← Styled QR from beautiful-qr-code
│     │  QR Code     │     │     Green-themed, with Suiki logo center
│     │              │     │
│     └──────────────┘     │
│                          │
│  Show QR code            │  ← Large heading
│  Please show your        │
│  QR-code to cashier      │
│                          │
│  ┌──────────────────┐    │
│  │  Enter code      │    │  ← Manual code entry fallback
│  └──────────────────┘    │
└──────────────────────────┘
```

### 3.4 Congratulations / Reward Claim

**Reference:** Screenshot 02 (center screen)

**Layout:** Bottom sheet or full-page with ticket/voucher styling:
- Scalloped/perforated edge (CSS clip-path or SVG)
- Confetti animation on appear
- Discount details: percentage, due date, one-time flag
- QR code at bottom (for merchant to scan)
- "Continue" CTA

### 3.5 Merchant Dashboard (`/merchant/`)

**Current:** Functional but unstyled.

**Redesign:**
- Same glassmorphic dark green theme
- Program cards with stamp count, active customers count
- "Create New Program" prominent CTA
- Each program: tap to see QR code for customers to scan

### 3.6 Merchant Program Detail (`/merchant/[programId]`)

- Program stats: total stamps issued, active cards, completions
- Large QR code (beautiful-qr-code) for customers to scan
- Stamp configuration display
- "Edit Program" (future)

### 3.7 Landing Page (`/`)

- Hero: app mockup + tagline
- Value props: for merchants + for customers
- How it works: 3 steps
- CTA: "Connect Wallet to Start"
- Footer: Sui logo, GitHub link

---

## 4. Navigation Architecture

### 4.1 Bottom Navigation (Customer)

| Tab | Icon | Route | Label |
|-----|------|-------|-------|
| Home | `Home` | `/customer/` | Home |
| Cards | `CreditCard` | `/customer/cards` | Cards |
| Search | `Search` | `/customer/search` | Search |
| QR | `QrCode` | `/customer/scan` | Scan |

Active state: icon + label turn `--color-primary`, dot indicator below.

### 4.2 Top Header (Shared)

- Left: Suiki logo (leaf icon)
- Right: notification bell (count badge) + user avatar (wallet connected state)
- No hamburger menu — everything in bottom nav

### 4.3 New Routes Needed

| Route | Purpose |
|-------|---------|
| `/customer/cards` | All cards progress list |
| `/customer/search` | Merchant discovery/search |
| `/customer/cards/[cardId]` | Individual card detail + QR |
| `/customer/cards/[cardId]/reward` | Congratulations/claim screen |

---

## 5. QR Code Integration

### 5.1 Package: `beautiful-qr-code`

Replace `qrcode.react` with [`beautiful-qr-code`](https://github.com/mblode/beautiful-qr-code).

**Styling:**
- Color: `#4ade80` (primary green) on transparent/dark background
- Center logo: Suiki leaf icon
- Corner style: rounded dots (matching the glassmorphic aesthetic)
- Error correction: High (to accommodate center logo)

**Usage locations:**
- Customer scan page: large QR (customer's wallet address + card ID)
- Merchant program detail: large QR (program ID for customers to scan)
- Congratulations sheet: small QR (voucher/reward claim code)
- Replace ALL barcodes from the reference design with QR codes

### 5.2 QR Utilities Update

Update `src/lib/qr-utils.ts` to support the new package and generate styled QR data.

---

## 6. PWA Enhancements

### 6.1 Manifest Updates

```json
{
  "background_color": "#0a1a14",
  "theme_color": "#4ade80",
  "orientation": "portrait",
  "categories": ["shopping", "lifestyle"]
}
```

### 6.2 App-Like Behaviors

- Safe area insets (CSS `env(safe-area-inset-*)`)
- Overscroll behavior: none (prevent pull-to-dismiss)
- Standalone display: hide browser chrome
- Splash screen: Suiki logo on dark green gradient
- Status bar: dark content on transparent

---

## 7. Micro-Interactions & Animations

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Card press | Scale 0.97 → 1.0 | 150ms ease-out |
| Card expand | Height + opacity spring | 250ms |
| Tab switch | Active pill slide | 200ms |
| Stamp earned | Pop scale 1.0 → 1.2 → 1.0 + confetti | 400ms |
| Sheet open | Slide up + backdrop fade | 350ms spring |
| QR appear | Fade in + subtle scale | 300ms |
| Page transition | Fade + slight Y translate | 200ms |
| Merchant card hover | Subtle glow + border brighten | 150ms |
| Search focus | Border glow expand | 200ms |

---

## 8. Implementation Phases

### Phase 1: Foundation (P0)
1. Update `globals.css` — new color palette, glass tokens, animation tokens
2. Create `PageShell` component (safe areas, max-width, scroll container)
3. Create `GlassCard` component
4. Create `BottomNav` component
5. Update `manifest.json` colors
6. Install `beautiful-qr-code`, create `BeautifulQR` component
7. Create `StampGrid` component
8. Create `ProgressBar` component
9. Update `site-header.tsx` to slim header

### Phase 2: Customer Screens (P0)
1. Redesign `/customer/` home page
2. Create `/customer/cards` route (cards progress list)
3. Create `/customer/search` route
4. Redesign `/customer/scan` with beautiful QR
5. Create `MerchantCard` component with expand/collapse
6. Create `CongratulationsSheet` component

### Phase 3: Merchant Screens (P1)
1. Redesign `/merchant/` dashboard
2. Redesign `/merchant/[programId]` detail
3. Redesign `/merchant/create` flow
4. Add beautiful QR to merchant pages

### Phase 4: Polish & Delight (P1)
1. Feature banners (Birthday Club, Referral, etc.)
2. Merchant discovery carousel
3. Confetti animation on reward claim
4. Skeleton loading states for all data-fetching screens
5. Empty states with illustrations
6. Pull-to-refresh behavior
7. Page transition animations

### Phase 5: PWA Hardening (P2)
1. Offline fallback page
2. App install prompt banner
3. Push notification UI (future)
4. Splash screen optimization
5. Treat picker (drag-to-select) — future feature

---

## 9. Assets Needed

| Asset | Type | Source |
|-------|------|--------|
| Suiki leaf logo | SVG | Existing (needs green variant) |
| Empty state illustrations | SVG | Create or source |
| Merchant placeholder cover | Image | Create gradient placeholder |
| Confetti animation | CSS/JS | Lightweight confetti library |
| Stamp emoji set | Emoji | System emoji (rendered as images) |

---

## 10. Accessibility Checklist

- [ ] All text meets 4.5:1 contrast on new green backgrounds
- [ ] Glass blur doesn't reduce text readability below WCAG AA
- [ ] Bottom nav has proper ARIA labels and roles
- [ ] QR codes have alt text with the encoded value
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Touch targets minimum 44x44px
- [ ] Focus rings visible on all interactive elements
- [ ] Screen reader can navigate stamp grid meaningfully
- [ ] Expandable cards announce state (expanded/collapsed)
- [ ] Search input has visible label (not placeholder-only)

---

## 11. Technical Notes

- **No NFC** — All stamp collection via QR code scanning only
- **beautiful-qr-code** — Replaces all barcodes AND the current `qrcode.react` usage
- **Tailwind v4** — All tokens via CSS custom properties in `globals.css`
- **Next.js 16** — Read `node_modules/next/dist/docs/` before modifying routing
- **React 19** — Use `use()` hook for data, Suspense boundaries
- **Mobile-first** — Max-width container (430px) centered on desktop, full-width on mobile
