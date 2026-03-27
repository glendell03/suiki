# Suiki UI Refactor — Design Spec
**Date:** 2026-03-26
**Status:** Approved
**Scope:** Total UI refactor — customer and merchant pages, components, design system

---

## 1. Goals

Achieve a native-feeling mobile-first UI matching the reference design: deep green glassmorphic theme with iOS 26 Liquid Glass aesthetic, Framer Motion animations, minimalist icon-driven navigation, and consistent design tokens throughout.

Specific problems being solved:
- Wallet address displayed raw in header avatar → replace with icon + dropdown
- Merchant logo images blocked by CSP domain restrictions → use raw `<img>` bypassing Next.js optimization
- QR code is unstyled → white floating card with rounded-dot `BeautifulQR`
- Animations absent → Framer Motion page transitions and micro-interactions
- Bottom nav is standard tabs → floating glass pill with icon-only tabs
- Stamp display is plain dots → circular bordered slots with emoji and gift icon

---

## 2. Design System & Foundation

### Typography
- **Body:** Geist Sans (existing, `--font-geist-sans`)
- **Display/headings:** Plus Jakarta Sans — loaded via `next/font/google`, CSS variable `--font-display`
- Applied to: greeting headline (`Hey, [name]!`), section titles, card merchant names

### iOS 26 Liquid Glass Tokens (additions to `globals.css`)
```css
--liquid-bg: rgba(16, 52, 33, 0.55);
--liquid-border: rgba(255, 255, 255, 0.1);
--liquid-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.1);
--liquid-blur: blur(32px) saturate(1.8);
--liquid-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.08) inset;
```

New CSS class `.liquid-surface` for the floating nav and dropdowns:
```css
.liquid-surface {
  background: var(--liquid-bg);
  backdrop-filter: var(--liquid-blur);
  -webkit-backdrop-filter: var(--liquid-blur);
  border: 1px solid var(--liquid-border);
  box-shadow: var(--liquid-shadow);
}
```

Updated `.glass-card`:
- Blur increases from `20px` to `32px`
- Add luminous top-edge highlight via `box-shadow` inset

### Animation System (Framer Motion)
Replace CSS `.tap-target` scale with Framer Motion `whileTap={{ scale: 0.96 }}` on all interactive cards and buttons. The `.tap-target` CSS class is deprecated by this refactor — remove it from `globals.css` and update any remaining usages.

**Page transitions:** Wrap route content in `<AnimatePresence>` at layout level. Each page uses:
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
>
```

**Staggered list entrance:** Card lists use `staggerChildren: 0.06` so cards slide up sequentially on mount.

**Spring card expand:** Replace CSS `grid-template-rows: 0fr → 1fr` with Framer Motion `AnimateHeight` using `spring({ stiffness: 400, damping: 30 })`.

**Stamp fill animation:** When stamps count increases, new stamps animate in with `scale: [0, 1.2, 1]` + `opacity: [0, 1]` stagger.

### View Transitions
Enable `experimental.viewTransition = true` in `next.config.ts` for native browser View Transitions on route changes (complement to Framer Motion).

### Images
- Remove all `next/image` `<Image>` usage for merchant logos
- Use raw `<img>` tags with no optimization — bypasses Next.js domain restrictions
- Fallback: Lucide `Store` icon when `src` is absent or errors
- CSP update: change `img-src 'self' data: blob:` → `img-src * data: blob:` to allow any merchant image URL

---

## 3. Navigation

### Header (`src/app/site-header.tsx`)
- Logo left: unchanged (`Leaf` icon + "Suiki")
- Right side: `Bell` icon button + **`WalletDropdown`** component
- `WalletDropdown`: renders `UserRound` (Lucide) icon in a 32×32 circular glass pill
- On tap: Framer Motion dropdown animates down (`y: -8 → 0`, `opacity: 0 → 1`)
- Dropdown contents:
  - Wallet address (truncated, monospace, copy-to-clipboard button)
  - SUI balance display
  - "Disconnect" button (red tinted)
- Click-outside closes dropdown

### Bottom Nav (`src/components/bottom-nav.tsx`) — total rebuild
- **Floating glass pill** — not edge-pinned
- Position: `fixed bottom-[calc(16px+env(safe-area-inset-bottom))]`, centered horizontally
- Dimensions: `max-width: 280px`, `border-radius: 999px`, `padding: 10px 20px`
- Material: `.liquid-surface` class
- 4 tabs, **icons only, no labels**: `Home`, `CreditCard`, `Search`, `QrCode` (all Lucide)
- **Scan tab**: solid `#4ade80` pill (`border-radius: 14px`, `width: 46px`, `height: 36px`) inside the floating nav — icon is dark (`#052e16`)
- Active non-scan tabs: icon color transitions to `#4ade80` with a `0 0 8px rgba(74,222,128,0.5)` glow
- Active indicator: Framer Motion `layoutId="nav-active"` morphs position between tabs
- `PageShell` / `.pb-nav` updated: `padding-bottom: calc(80px + env(safe-area-inset-bottom))`

---

## 4. Customer Pages

### Home (`src/app/customer/page.tsx`)

**Greeting section:**
- `Hey, [name]!` in Plus Jakarta Sans, 28px bold, with the name in `--color-primary`
- Subtitle: `Let's earn more stamps` in `--color-text-secondary`
- Name derived from wallet address: `address.slice(0, 6)`

**Search bar:**
- Full-width rounded pill (`.glass-card`, `border-radius: 999px`)
- Lucide `Search` icon left, placeholder "Search merchants..."

**2×2 Feature Grid (`src/components/feature-grid.tsx` — new):**
Four equal tiles in a `grid-cols-2` layout, each a glass card with:
- Lucide icon top-left (not emoji)
- Feature title (bold, white)
- Short subtitle (accent color matching tile gradient)
- Arrow icon (`ArrowUpRight`) top-right

| Tile | Icon | Gradient | Accent |
|------|------|----------|--------|
| Earn Stamps | `Stamp` | teal | `#2dd4bf` |
| My Cards | `CreditCard` | green | `#4ade80` |
| Rewards | `Gift` | amber | `#f59e0b` |
| Lucky Draw | `Sparkles` | rose | `#f43f5e` |

**My Cards section:**
- Section header row: "My Cards" + "View all →" link
- Merchant accordion rows using `MerchantCard` component
- Framer Motion `staggerChildren: 0.06` on list mount
- Each card: raw `<img>` logo (fallback Lucide `Store`), name, category, stamp count badge (`current/total`)

### Cards Page (`src/app/customer/cards/page.tsx`)
- Same accordion list sorted by progress descending
- Expanded state reveals:
  - **Circular stamp grid** (rebuilt `StampGrid`)
  - Segmented progress bar (`ProgressBarStamps`, unchanged)
  - "Show QR" → navigates to `/customer/cards/[cardId]`
  - "Claim Reward" (gold, only when complete)

### Stamp Grid (`src/components/stamp-grid.tsx`) — rebuild
- Layout: `grid-cols-5` (or fewer for small totals)
- **Filled slot:** circular border (`rgba(245,158,11,0.5)`), amber fill background, merchant emoji inside
- **Empty slot:** dashed circular border (`rgba(74,222,128,0.15)`), no fill
- **Last slot (reward):** green circular border, Lucide `Gift` icon in green — always shown regardless of fill state
- Slot size: `40px` on cards page, `52px` on card detail page
- Framer Motion stagger on initial render; new stamps animate `scale: [0, 1.2, 1]`

### Card Detail (`src/app/customer/cards/[cardId]/page.tsx`)
- Back: Lucide `ChevronLeft` button
- Merchant header: raw `<img>` (fallback `Store` icon), name + "Loyalty Card" subtitle
- Large stamp grid (52px slots)
- Replace `QrCode` (qrcode.react) with `BeautifulQR` — already built, wire it in
- "Claim Your Reward" CTA when complete

### Scan Page (`src/app/customer/scan/page.tsx`) — total redesign
- **Background:** `linear-gradient(160deg, #0a3d20 0%, #0a2a18 50%, #061a10 100%)`, full screen
- Back arrow top-left (Lucide `ChevronLeft`, white)
- Center content:
  - Heading: "Show QR Code" (Plus Jakarta Sans, bold, white)
  - Subtitle: "Please show this to the cashier" (muted white)
  - **White floating card:** `bg-white`, `rounded-3xl`, `shadow-2xl`, `p-6`
    - `BeautifulQR` inside: size 260px, `foregroundColor: "#111"`, `backgroundColor: "#ffffff"`, `radius: 0.7` — these are QR rendering data values, not design tokens; raw hex is acceptable here per exception in `beautiful-qr.tsx`
  - Wallet address in monospace below the card

---

## 5. Merchant Pages

Apply consistent Liquid Glass tokens (`.glass-card` updated blur, `.liquid-surface` for elevated elements). No structural changes. Switch all `<Image>` to `<img>` for logos.

---

## 6. New Components

| File | Purpose |
|------|---------|
| `src/components/wallet-dropdown.tsx` | Avatar icon + animated dropdown with address/balance/disconnect |
| `src/components/feature-grid.tsx` | 2×2 home page feature tiles |

---

## 7. Package Changes

**Add:**
```json
"@next/font": "already included via next/font/google"
```
No new npm packages needed. Plus Jakarta Sans loaded via `next/font/google` (already available in Next.js).

**No removals** — `qrcode.react` stays as fallback (already imported in some places), `beautiful-qr-code` promoted to primary.

---

## 8. Files Modified

| File | Change type |
|------|-------------|
| `src/app/globals.css` | Add liquid glass tokens, update glass-card, add display font variable |
| `src/app/layout.tsx` | Add Plus Jakarta Sans font |
| `next.config.ts` | Add `viewTransition`, update CSP `img-src` |
| `src/app/site-header.tsx` | Add WalletDropdown |
| `src/app/customer/page.tsx` | Full redesign — greeting, 2×2 grid, staggered cards |
| `src/app/customer/cards/page.tsx` | Apply new StampGrid, Framer Motion |
| `src/app/customer/cards/[cardId]/page.tsx` | Wire BeautifulQR, raw img |
| `src/app/customer/scan/page.tsx` | Full redesign — gradient bg, white QR card |
| `src/components/bottom-nav.tsx` | Total rebuild — floating liquid pill |
| `src/components/merchant-card.tsx` | Raw img logo, Framer Motion expand, new StampGrid |
| `src/components/stamp-grid.tsx` | Rebuild — circular bordered slots, gift icon |
| `src/components/beautiful-qr.tsx` | Update colors for white-bg mode |
| `src/components/page-shell.tsx` | Update pb-nav spacing |
| `src/components/wallet-dropdown.tsx` | New |
| `src/components/feature-grid.tsx` | New |

---

## 9. Out of Scope

- NFC (not implemented, not planned)
- Light mode / theme toggle (app is always dark)
- Merchant-side UI structural changes
- Backend / lib / hooks / types changes
- New blockchain interactions
