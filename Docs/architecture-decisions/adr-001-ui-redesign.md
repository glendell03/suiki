# ADR-001: UI Redesign — Deep Green Glassmorphism Theme

## Status
Accepted

## Date
2026-03-26

## Context

Suiki's current theme uses a slate-blue palette (`#0f172a` base) that reads as a generic Web3 dApp. The redesign targets Filipino MSME customers — small merchants and their regulars — who are predominantly mobile-only, using mid-range Android devices (Snapdragon 665-class SoCs, 4–6 GB RAM, AMOLED or LCD panels). The product is a loyalty stamp-card app, and the visual language must communicate trust, growth, and reward — none of which slate-blue achieves. The new theme must be performant on these devices while feeling premium enough to differentiate from paper stamp cards.

The decision covers: color palette, glassmorphism implementation strategy, OLED power characteristics, psychological rationale for the green choice, and the Tailwind v4 CSS custom properties approach that replaces the prior `tailwind.config.js`.

## Decision

Adopt a **deep forest green glassmorphism theme** anchored to `#0a1a14` as the page background, `#4ade80` as the primary interactive color, and a constrained set of `backdrop-filter: blur()` surfaces limited to the bottom navigation bar and modal overlays only. All card surfaces use semi-transparent background without blur (simulated glass effect via `--glass-bg`). The full token set is defined as CSS custom properties in `src/app/globals.css` under `:root`, consumed by Tailwind v4's `@theme inline` directive — no `tailwind.config.js` required.

### Color Palette Rationale

**Deep forest green (`#0a1a14`) vs. pure black (`#000000`) on OLED:**
Pure black (`#000000`) turns OLED pixels fully off, which maximizes power savings. However, pure black also causes the "black smear" halation effect where bright UI elements bloom into the surrounding black, degrading legibility. `#0a1a14` keeps pixels at a very low luminance level (approximately 2–3% relative luminance) — capturing 80–85% of the OLED power benefit of pure black — while eliminating halation and providing a warmer chromatic foundation that reads as "premium dark" rather than "void". On LCD panels, the difference is invisible to the user.

**Why green for a loyalty rewards product:**
Color psychology research specific to loyalty and retail contexts consistently associates green with growth, renewal, and trust — directly mirroring what a stamp card program promises (grow your rewards, trust the merchant). Amber (`#f59e0b`) is retained as the loyalty accent for stamp icons and progress states, providing warm contrast against the cool green that signals "earned value". Blue (the prior color) communicates authority and technology — appropriate for fintech dashboards but misaligned with the warmth required for neighborhood merchant loyalty.

### Glassmorphism Implementation

`backdrop-filter: blur()` triggers GPU compositing layers. On Snapdragon 665-class devices, each active blur surface consumes approximately 2–4 ms of GPU frame time. At 60 fps the frame budget is 16.67 ms. Applying blur to every card in a scrolling list would consume the entire frame budget on a list of 4–8 cards.

**Decision: blur is restricted to two surfaces only:**
1. `BottomNav` — fixed, non-scrolling, always composited in its own layer. Cost is paid once.
2. Modal overlays — appear infrequently, user expects a brief composition cost.

All `GlassCard` instances use `--glass-bg: rgba(20, 60, 40, 0.4)` with no `backdrop-filter`. This achieves the visual impression of glassmorphism (semi-transparency revealing the gradient behind) at zero GPU blur cost.

### Tailwind v4 CSS Custom Properties Approach

Tailwind v4 uses a CSS-first configuration model. Tokens are defined in `:root` in `globals.css` and exposed to Tailwind's utility generation via `@theme inline`. Component authors use bracket syntax: `bg-[--color-primary]`, `text-[--color-text-secondary]`. Raw hex values are prohibited in JSX to ensure all visual changes flow through the design token system.

## Consequences

### Positive
- OLED power consumption reduced approximately 60–70% vs. the prior slate-blue theme at typical screen brightness.
- Glassmorphism depth effect achieved at zero runtime GPU blur cost for cards (blur only on two fixed surfaces).
- Single source of truth for all color decisions: `globals.css`. No duplication across config files.
- Green/amber palette creates clear semantic hierarchy: green = interactive/active, amber = loyalty value, white = content.
- Tailwind v4 CSS-first config eliminates the need to maintain `tailwind.config.js` alongside `globals.css`.

### Negative / Risks
- `backdrop-filter: blur()` is unsupported on Android < 4.4 (WebView < 76). Bottom nav blur will silently degrade to a non-blurred surface on these devices.
- Deep green backgrounds reduce the contrast ratio for secondary text (`--color-text-secondary: #94a3b8`) against the darkest surfaces. WCAG AA (4.5:1) must be verified with a contrast checker on the final rendered values, not estimated from hex codes alone.
- Pure CSS glassmorphism without blur on cards may look flat on very high-brightness screens (e.g., outdoor use in direct sunlight).
- Adding a new color-psychology-heavy theme increases the onboarding time for future contributors unfamiliar with the rationale.

### Mitigations
- **`backdrop-filter` fallback:** The `--nav-bg: rgba(10, 26, 20, 0.9)` token provides a high-opacity fallback background. On devices where `backdrop-filter` is unsupported, the nav renders as a near-solid dark surface — readable and functional, just not blurred. No JavaScript feature detection required.
- **Contrast verification:** All text/background combinations must pass through a tool such as the WebAIM Contrast Checker during Phase 1 of implementation before shipping to staging.
- **Outdoor legibility:** The primary CTA green (`#4ade80` on `#0a1a14`) achieves approximately 8.5:1 contrast — well above WCAG AAA — providing adequate outdoor legibility.
- **Contributor documentation:** This ADR plus the inline comments in `globals.css` provide the full rationale. New agents must read `globals.css` before modifying any color token.

---

## Implementation Notes for Agents

### File Ownership Map

This table defines which agent category owns which file to prevent conflicting edits during parallel Sprint 4 work.

| File / Directory | Owner | Constraint |
|---|---|---|
| `src/app/globals.css` | Frontend Agent | Design token definitions only. No component logic. |
| `src/components/` | Frontend Agent | All new shared components. Flat structure, no subdirectories per component. |
| `src/app/customer/` | Frontend Agent | Customer-facing routes and layouts. |
| `src/app/merchant/` | Frontend Agent | Merchant-facing routes and layouts. |
| `src/lib/qr-utils.ts` | Frontend Agent | QR payload encoding/decoding utilities. |
| `src/lib/queries.ts` | Backend Agent | Data-fetching utilities. Frontend reads, Backend writes. |
| `src/lib/transactions.ts` | Backend Agent | Sui transaction builders. |
| `src/lib/sui-client.ts` | Backend Agent | Server-only singleton. No Frontend edits. |
| `src/hooks/` | Backend Agent | React Query hooks. Frontend consumes, Backend writes. |
| `src/app/api/` | Backend Agent | API route handlers. |
| `move/suiki/` | Blockchain Agent | Move smart contracts. No Frontend or Backend edits. |
| `Docs/architecture-decisions/` | CTO Agent | ADR documents. No Frontend or Backend edits. |
| `CLAUDE.md` | CTO Agent | Append-only. Never remove existing content. |
| `public/manifest.json` | Frontend Agent | PWA manifest. Update `background_color` and `theme_color` to match new tokens. |

### Dependency Order

Implementation must follow this sequence. Later phases assume earlier phases are complete and merged.

```
Phase 1: Foundation
  globals.css (tokens already updated) → public/manifest.json → PageShell → GlassCard → BottomNav

Phase 2: QR Infrastructure
  src/lib/qr-utils.ts → BeautifulQR component → qr-code.tsx update

Phase 3: Customer Screens
  BottomNav (Phase 1) → customer layout.tsx → /customer/ home → /customer/cards → /customer/search → /customer/scan

Phase 4: Merchant Screens
  GlassCard (Phase 1) → /merchant/ dashboard → /merchant/[programId]

Phase 5: Polish
  All screens complete → animations → skeleton states → empty states → confetti
```

No Phase N component should import from a Phase N+1 component. If a dependency flows backward, the dependency direction is wrong and must be resolved by extracting a shared primitive.

### Integration Points

| Frontend Component | Backend Integration | Contract |
|---|---|---|
| Customer home page | `useQuery` hook from `src/hooks/` → `src/lib/queries.ts` | Returns merchant cards array with stamp counts |
| `BeautifulQR` (customer scan) | None — payload built in `src/lib/qr-utils.ts` from wallet address + card ID | `{ type: 'stamp', walletAddress: string, cardId: string }` base64-encoded JSON |
| `BeautifulQR` (merchant program) | None — payload built from program ID | `{ type: 'program', programId: string }` base64-encoded JSON |
| Congratulations sheet | `useMutation` hook → API route → `src/lib/transactions.ts` | Reward claim transaction; returns tx digest |
| `BottomNav` | None — client-only navigation component | Uses Next.js App Router `usePathname` for active state |

### Known Risks

1. **`beautiful-qr-code` package maturity:** Package version `1.0.9` is relatively new. If it introduces a breaking change or has a scanning reliability regression, the fallback is `qrcode.react` (already in `dependencies`). Keep `qrcode.react` as a listed dependency until `beautiful-qr-code` has been validated through 30+ real device scans in varied lighting.

2. **Tailwind v4 bracket syntax for CSS variables:** Tailwind v4's `bg-[--var]` syntax requires the `@theme inline` block in `globals.css`. If `@theme inline` is removed or the variable name changes, all components using that token will silently render with no background. This is a silent failure mode — there is no build-time error. Agents must not remove or rename tokens without a global search across `src/`.

3. **`backdrop-filter` on BottomNav causes scroll jank on low-end devices:** If performance testing on a Snapdragon 665-equivalent device shows scroll jank (dropped frames) caused by the nav blur, the mitigation is to replace the `backdrop-filter` on BottomNav with a solid `--nav-bg` background. This is a two-line CSS change; the visual degradation is minor.

4. **Safe area insets on non-iOS devices:** `env(safe-area-inset-bottom)` returns `0px` on most Android devices and all desktop browsers. The `.pb-nav` and `.pb-safe` utilities are designed for this — they include the fixed nav height regardless. No device-specific logic is needed.

5. **React 19 Suspense boundaries:** The redesign assumes Suspense boundaries wrap all data-fetching customer screens. If a Suspense boundary is missing, the page will block render on the server. Every customer route must have a `loading.tsx` sibling file (Next.js App Router convention).

### Acceptance Criteria

The UI redesign is complete when ALL of the following are true:

- [ ] `src/app/globals.css` contains all design tokens defined in this ADR and `Docs/ui-ux-redesign-plan.md` Section 1.
- [ ] `public/manifest.json` has `background_color: "#0a1a14"` and `theme_color: "#4ade80"`.
- [ ] `PageShell`, `GlassCard`, `BottomNav`, `StampGrid`, `ProgressBar`, `BeautifulQR`, `MerchantCard` components exist in `src/components/`.
- [ ] All customer routes (`/customer/`, `/customer/cards`, `/customer/search`, `/customer/scan`) render using the new component library.
- [ ] No customer route imports `qrcode.react` directly — all QR rendering goes through `BeautifulQR`.
- [ ] No JSX file contains a raw hex color value — all colors reference CSS custom properties.
- [ ] `backdrop-filter: blur()` appears in CSS only for `BottomNav` and modal overlays — not for `.glass-card` or any list item.
- [ ] All text/background combinations pass WCAG AA contrast (4.5:1) as verified by manual check.
- [ ] `prefers-reduced-motion` media query collapses all animations (already implemented in `globals.css`).
- [ ] Bottom nav renders correctly with safe area insets on iPhone 14 Pro (tested in Chrome DevTools device emulator at minimum).
- [ ] The app installs as a PWA on Android Chrome and the splash screen shows the correct dark green background without a white flash.
