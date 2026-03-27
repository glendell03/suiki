# ADR-003: Navigation — Fixed Bottom Nav (PWA)

## Status
Accepted

## Date
2026-03-26

## Context

Suiki's current navigation is a top-level header with unclear hierarchy — there is no persistent navigation affordance that communicates available screens or the user's current location within the app. For a PWA targeting mobile-only Filipino MSME customers, this creates orientation failures: new users do not know where to go after connecting their wallet, and returning users cannot orient themselves after a background interruption.

The app must feel like a native app, not a website. Native iOS and Android loyalty apps (Starbucks, 7-Eleven, GrabFood) all use persistent bottom navigation as the primary orientation mechanism on mobile. The redesign adopts the same pattern.

This decision covers: the 4-tab structure and tab selection rationale, fixed positioning with safe area insets, the 430px max-width phone frame model, desktop behavior, accessibility requirements, and deep linking requirements for PWA notifications.

## Decision

Implement a **fixed bottom navigation bar** (`BottomNav` component in `src/components/bottom-nav.tsx`) for all customer-facing routes. The nav is not rendered on merchant routes. It contains exactly 4 tabs in the following order (left to right):

| Position | Label | Icon (Lucide) | Route |
|---|---|---|---|
| 1 | Home | `Home` | `/customer/` |
| 2 | Cards | `CreditCard` | `/customer/cards` |
| 3 | Search | `Search` | `/customer/search` |
| 4 | Scan | `QrCode` | `/customer/scan` |

### Why 4 Tabs (Not 3 or 5)

**3 tabs** would require collapsing either Cards + Search (related but distinct intents) or Home + Cards (the two highest-frequency actions) into one tab with sub-navigation. Sub-navigation inside a bottom tab violates the principle that each tab is a distinct top-level destination.

**5 tabs** would introduce a fifth destination that does not currently exist in the product. Possible candidates (Notifications, Profile, Rewards) are not yet implemented. Adding a fifth tab for a non-existent screen creates dead navigation. The rule is: tabs represent existing, fully-implemented top-level destinations.

**4 tabs** covers the four distinct user intents in order of frequency:
1. **Home** — See my cards and discover merchants (highest frequency: every session start).
2. **Cards** — Track all my stamp card progress (high frequency: checking progress).
3. **Search** — Find new merchants (medium frequency: discovery sessions).
4. **Scan** — Show my QR to the cashier (medium frequency: at point of sale).

The order follows natural left-to-right progressive disclosure: from "what I have" (Home, Cards) to "what I want" (Search) to "take action" (Scan).

**Thumb reach analysis:** On a 430px-wide phone frame, the 4-tab layout allocates approximately 107px per tab. All four tabs are within comfortable thumb reach from the home position (bottom center of the screen), which is the natural resting position for single-handed use.

### Fixed Positioning with Safe Area Insets

The nav is `position: fixed` at the bottom of the viewport. It must account for:

1. **Device safe area (iOS home indicator / Android gesture bar):** Uses `env(safe-area-inset-bottom)` in `padding-bottom` to push nav content above the home indicator. Defined via the `.pb-safe` utility class in `globals.css`.
2. **Fixed nav height token:** `--nav-height: 4rem` (64px). This value is referenced by the `.pb-nav` utility applied to main page content containers to prevent scrollable content from being obscured behind the nav.
3. **Scroll content clearance:** Every customer page that has a scrollable main area must apply `className="pb-nav"` to its scrollable container. This is enforced by `PageShell` wrapping all customer pages.

### 430px Max-Width Phone Frame Model

All customer-facing pages are constrained to `max-width: 430px` centered on larger viewports. This matches the widest standard phone screen (iPhone 15 Pro Max at 430 CSS pixels) and avoids the layout breaking on tablet or desktop screens where an unconstrained 100% width layout would produce absurdly wide stamp cards.

**Desktop behavior:**
- The page body renders the `page-gradient` background at full viewport width.
- The content container is centered at `max-width: 430px` with `margin: 0 auto`.
- The `BottomNav` is also constrained to the 430px column and centered — it does not span the full desktop width.
- This creates a "phone frame" visual on desktop that communicates "this is a mobile app" without requiring a literal phone frame bezel.

### Merchant Routes: No Bottom Nav

Merchant routes (`/merchant/` and sub-routes) use a simple top header only. Merchants are a distinct user persona with a distinct workflow (manage programs, view QR codes) and different navigation needs. Mixing merchant and customer navigation in the same BottomNav would create confusion. Merchant navigation is intentionally simpler: header with logo + wallet state, no persistent bottom nav.

### Active State and Visual Design

- Active tab: icon + label text color change to `--color-primary` (`#4ade80`).
- Active indicator: a green dot or pill below the active tab's icon (not underline — underlines are a web pattern, not a native app pattern).
- Inactive tabs: icon + label at `--color-text-muted` opacity.
- Nav background: `--nav-bg: rgba(10, 26, 20, 0.9)` with `backdrop-filter: blur(20px)` — one of only two surfaces in the app permitted to use `backdrop-filter` (see ADR-004).

### Accessibility

The `BottomNav` component must implement:

- `<nav aria-label="Main navigation">` as the root element — declares the landmark region to screen readers.
- Each tab is a `<Link>` (Next.js App Router) rendered as an `<a>` element — native keyboard focus and screen reader announcement.
- Active tab: `aria-current="page"` on the active link — announces "current page" to VoiceOver and TalkBack.
- Icons are `aria-hidden="true"` — decorative; the visible label text provides the accessible name.
- Tab labels are always visible (not hidden behind icons-only mode) — WCAG 2.5.3 (Label in Name).
- All tabs meet the 44×44px minimum touch target requirement — each tab occupies at least 64px height (the nav height) × ~107px width.
- Focus ring must be visible on keyboard navigation — use `focus-visible:ring-2 focus-visible:ring-[--color-primary]` Tailwind utilities.

### Deep Linking for PWA Notifications

All four tab destinations must be independently deep-linkable via URL. This is a hard requirement because PWA push notifications (planned for a future sprint) link directly to app screens. If a screen is not URL-addressable, a notification cannot link to it.

Required URL structure:
- `/customer/` — Home
- `/customer/cards` — Cards list
- `/customer/search` — Search / merchant discovery
- `/customer/scan` — QR code display

Each route must have a `page.tsx` file in the Next.js App Router directory structure. No tab may rely on in-memory state or a programmatic navigation action to reach its content — the content must render correctly when the URL is loaded directly (cold start, no prior navigation history).

This also means: no tab's content may depend on data passed via `router.push()` state. All data must come from URL params or be fetched fresh on page load.

## Consequences

### Positive
- Navigation pattern matches user expectations set by native loyalty apps — zero learning curve for the intended audience.
- All four top-level destinations are always visible and one tap away — no hidden navigation.
- Fixed nav position means the navigation is always accessible regardless of scroll position.
- Deep-linkable URLs enable PWA notifications to route users directly to relevant screens.
- Accessibility implementation (ARIA current page, visible labels, touch targets) satisfies WCAG 2.1 AA for navigation landmarks.

### Negative / Risks
- Fixed bottom nav reduces the visible content area by `--nav-height` (64px) plus `env(safe-area-inset-bottom)` (up to 34px on iPhone). On small screens (iPhone SE, 375px wide) this is a significant content reduction.
- `backdrop-filter: blur()` on the nav (permitted per ADR-004) means the nav adds a GPU compositing layer. On very low-end devices, this layer may cause scroll jitter. See ADR-004 for the mitigation.
- The 430px max-width constraint means the desktop experience is intentionally narrow. This is appropriate for a mobile PWA but may feel awkward to users accessing via a large monitor.
- Future addition of a 5th tab would require redesigning the active state indicator and verifying thumb reach geometry — not a trivial change once users have learned the 4-tab layout.

### Mitigations
- **Reduced content area:** The `--nav-height` token is referenced by `.pb-nav` which adds precisely the right padding to prevent content obscuring. No manual pixel calculation is needed in any route component.
- **GPU compositing on low-end devices:** If scroll jitter is observed during performance testing (see ADR-004), the `backdrop-filter` on `BottomNav` is removed and replaced with a solid `--nav-bg` background. This is a one-line CSS change with no API impact.
- **430px desktop feel:** The full-bleed `page-gradient` background fills the desktop viewport, making the narrow column feel intentional (an app panel) rather than broken.
- **5th tab future-proofing:** The `BottomNav` component accepts a `tabs` prop array — the tab configuration is data-driven, not hardcoded. Adding a 5th tab requires adding one object to the array and creating the corresponding route. The component layout must be verified for thumb reach at that point.
