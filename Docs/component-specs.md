# Suiki Component Specs

**Date:** 2026-03-26
**Status:** Authoritative — Frontend agent builds from this document
**Design system:** `src/app/globals.css` (deep green glassmorphic theme)
**Tailwind version:** v4 — use CSS variable bracket syntax: `bg-[--color-primary]`

---

## Conventions

- All CSS variable references use Tailwind v4 bracket syntax: `bg-[--color-primary]`
- Touch targets minimum 44×44px (WCAG 2.5.5)
- All interactive elements get `tap-target` class for press feedback
- Glass containers use `glass-card` class — do not replicate those styles inline
- Import Lucide React icons tree-shakably: `import { Home } from "lucide-react"`
- Reduced motion is handled globally in `globals.css` — no per-component `prefers-reduced-motion` queries needed unless adding `@keyframes`

---

## 1. PageShell

**File:** `src/components/page-shell.tsx`

**Purpose:** Mobile-app-like page wrapper. Enforces max-width, centers on desktop, applies safe-area insets, and manages the scrollable content region above the bottom nav.

### Props

```typescript
interface PageShellProps {
  /** Page content. */
  children: React.ReactNode;
  /** Whether to apply bottom nav padding (pb-nav). Default: true. */
  hasBottomNav?: boolean;
  /** Whether the page has a fixed header (adds padding-top to avoid overlap). Default: false. */
  hasHeader?: boolean;
  /** Additional classes for the inner content wrapper. */
  className?: string;
}
```

### Tailwind Classes

```
/* Outer centering wrapper — full screen, centers the narrow app column */
outer: "min-h-dvh w-full flex justify-center bg-[--color-bg-base]"

/* Inner app column — 430px max, full height, scroll container */
inner: "relative w-full max-w-[430px] flex flex-col overflow-y-auto"

/* Content area — applies page-gradient and safe-area paddings */
content: "page-gradient flex-1 px-[--spacing-page-x]"

/* With bottom nav padding */
contentWithNav: "pb-nav"

/* With fixed header offset (56px header + pt-safe) */
contentWithHeader: "pt-14"
```

### Accessibility

- `<main>` element wraps the content region with `role="main"` (implicit)
- `id="main-content"` for skip-to-content links

### States

| State | Behavior |
|-------|----------|
| Default | page-gradient background, scroll enabled |
| hasBottomNav=true | adds `pb-nav` so content is never hidden under nav |
| hasHeader=true | adds `pt-14` (56px) so content is never hidden under fixed header |

---

## 2. GlassCard

**File:** `src/components/glass-card.tsx`

**Purpose:** Frosted-glass container. The primary visual surface for cards, modals, and list items throughout the app. Applies the `glass-card` CSS utility and handles optional tap feedback.

### Props

```typescript
interface GlassCardProps {
  /** Card content. */
  children: React.ReactNode;
  /** Makes the card tappable — applies tap-target press scale. Default: false. */
  interactive?: boolean;
  /** onClick handler (requires interactive=true). */
  onClick?: () => void;
  /** Renders as a specific HTML element. Default: "div". */
  as?: "div" | "article" | "section" | "li";
  /** Additional Tailwind classes. */
  className?: string;
  /** ARIA label for interactive cards without visible text labels. */
  "aria-label"?: string;
}
```

### Tailwind Classes

```
/* Base */
base: "glass-card p-[--spacing-card-padding]"

/* Interactive variant adds tap feedback and cursor */
interactive: "tap-target cursor-pointer"

/* Hover border brightening is handled by .glass-card:hover in globals.css */
```

### Accessibility

- When `interactive=true`: renders as `<button>` (or use `role="button"` on `<div>` with `tabIndex={0}` and `onKeyDown` Enter/Space handler)
- Prefer `<button>` for actions, `<a>` for navigation — avoid `<div role="button">` unless wrapping complex children
- `aria-expanded` for expandable cards

### States

| State | Visual |
|-------|--------|
| Default | `--glass-bg` background, `--glass-border` border |
| Hover | `--glass-bg-hover` background, `--color-border` border (via CSS) |
| Active/press | `scale(0.97)` via `.tap-target:active` |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` |

---

## 3. BottomNav

**File:** `src/components/bottom-nav.tsx`

**Purpose:** Fixed 4-tab bottom navigation bar for the customer section. Active tab has a green filled circle indicator. Sits above the device home indicator via safe-area insets.

### Props

```typescript
interface BottomNavProps {
  /** Currently active route pathname — used to derive active tab. */
  currentPath: string;
}

interface NavTab {
  label: string;
  href: string;
  /** Lucide React icon component. */
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Aria label for screen readers (may differ from label). */
  ariaLabel: string;
}
```

### Tab Configuration (internal constant)

```typescript
const TABS: NavTab[] = [
  { label: "Home",   href: "/customer",        icon: Home,       ariaLabel: "Home" },
  { label: "Cards",  href: "/customer/cards",   icon: CreditCard, ariaLabel: "My stamp cards" },
  { label: "Search", href: "/customer/search",  icon: Search,     ariaLabel: "Search merchants" },
  { label: "Scan",   href: "/customer/scan",    icon: QrCode,     ariaLabel: "Show QR code" },
];
```

### Tailwind Classes

```
/* Fixed nav bar */
nav: "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50
      flex items-stretch justify-around
      pb-safe border-t border-[--color-border-subtle]"
nav-bg: "bg-[--nav-bg] backdrop-filter backdrop-blur-xl"
nav-height: "h-[--nav-height]"

/* Each tab button */
tab: "tap-target flex flex-col items-center justify-center gap-0.5 flex-1
      min-h-[44px] px-2"

/* Active tab — icon and label turn primary green */
tab-icon-active: "text-[--color-primary]"
tab-label-active: "text-[--color-primary]"

/* Inactive tab */
tab-icon-inactive: "text-[--color-text-muted]"
tab-label-inactive: "text-[--color-text-muted]"

/* Active dot indicator below label */
active-dot: "w-1 h-1 rounded-full bg-[--color-primary] mt-0.5"

/* Label text */
tab-label: "text-[10px] font-medium tracking-wide"
```

### Accessibility

- `<nav aria-label="Main navigation">`
- Each tab is `<a>` (navigation) with `aria-current="page"` when active
- Active tab: `aria-current="page"` attribute
- Icon has `aria-hidden="true"` — the label provides the text

### States

| State | Visual |
|-------|--------|
| Active | Icon + label `--color-primary`, dot indicator visible |
| Inactive | Icon + label `--color-text-muted`, no dot |
| Press | `scale(0.97)` via `.tap-target:active` |

---

## 4. StampGrid

**File:** `src/components/stamp-grid.tsx`

**Purpose:** Grid of stamp circles showing earned stamps vs empty slots. The final slot always shows a gift icon representing the reward. Supports configurable grid layouts (e.g. 3×3, 4×2).

### Props

```typescript
interface StampGridProps {
  /** Total number of stamp slots (e.g. 8, 9, 10). */
  totalStamps: number;
  /** Number of stamps currently earned. */
  earnedStamps: number;
  /**
   * Emoji character the merchant configured as their stamp icon.
   * Rendered at large size inside filled stamp circles.
   * @example "☕" | "🌸" | "🍩"
   */
  stampEmoji: string;
  /** Columns in the grid. Defaults to the square root of totalStamps, rounded up. */
  columns?: number;
  /** Size variant. Default: "md". */
  size?: "sm" | "md" | "lg";
  /** Accessible name for the grid (e.g. "Coffee Fellow stamp card, 5 of 8 stamps"). */
  "aria-label": string;
}
```

### Tailwind Classes

```
/* Grid container */
grid-sm: "grid gap-1.5"
grid-md: "grid gap-2"
grid-lg: "grid gap-3"

/* Grid columns (applied via style prop: gridTemplateColumns) */
/* Use inline style="grid-template-columns: repeat({columns}, 1fr)" */

/* Individual stamp slot */
slot-base: "rounded-full flex items-center justify-center aspect-square"

/* Size variants */
slot-sm: "w-8 h-8 text-base"
slot-md: "w-10 h-10 text-xl"
slot-lg: "w-14 h-14 text-3xl"

/* Earned stamp — filled amber glow */
slot-earned: "bg-[--color-accent-loyalty] shadow-[0_0_8px_rgba(245,158,11,0.4)]"

/* Empty stamp slot */
slot-empty: "bg-[--color-accent-loyalty-muted] border border-[--color-border-subtle]"

/* Final reward slot */
slot-reward: "bg-[--color-primary] shadow-[0_0_8px_rgba(74,222,128,0.4)]"
```

### Accessibility

- `role="list"` on grid, `role="listitem"` on each slot
- `aria-label` on the grid element (full description passed as prop)
- Each slot: `aria-label="Stamp {n} of {total}: {earned ? 'earned' : 'empty'}"` (last slot: "Reward slot")

### States

| Slot type | Visual |
|-----------|--------|
| Earned | Amber fill, emoji stamp, subtle amber glow |
| Empty | Muted amber bg, subtle border, no emoji |
| Reward (last) | Primary green fill, gift emoji `🎁` |

---

## 5. ProgressBarStamps

**File:** `src/components/progress-bar-stamps.tsx`

**Purpose:** Horizontal segmented progress bar — one discrete segment per stamp slot. Alternative to StampGrid for the Cards Progress screen. Segments turn green when earned.

### Props

```typescript
interface ProgressBarStampsProps {
  /** Total stamp slots. */
  totalStamps: number;
  /** Earned stamps count. */
  earnedStamps: number;
  /** Show "{earned}/{total} Stamps" label. Default: true. */
  showLabel?: boolean;
  /** Height variant. Default: "md". */
  size?: "sm" | "md";
  /** Accessible label for the progress bar. */
  "aria-label": string;
}
```

### Tailwind Classes

```
/* Wrapper */
wrapper: "flex flex-col gap-1.5"

/* Segment track */
track: "flex gap-1"

/* Individual segment */
segment-base: "flex-1 rounded-full transition-colors duration-[--duration-normal]"

/* Height variants */
segment-sm: "h-1.5"
segment-md: "h-2.5"

/* Earned segment */
segment-earned: "bg-[--color-primary]"

/* Empty segment */
segment-empty: "bg-[--color-bg-elevated]"

/* Label */
label: "text-xs font-medium text-[--color-text-secondary] tabular-nums"
```

### Accessibility

- `role="progressbar"` on the track wrapper
- `aria-valuenow={earnedStamps}` `aria-valuemin={0}` `aria-valuemax={totalStamps}`
- `aria-label` from prop
- Label text provides the numeric context visually

### States

| State | Visual |
|-------|--------|
| Default | Green filled segments, gray empty segments |
| Complete (all earned) | All segments `--color-primary`, label "8/8 Stamps" |

---

## 6. BeautifulQR

**File:** `src/components/beautiful-qr.tsx`

**Purpose:** Styled QR code using the `beautiful-qr-code` package. Green-themed with rounded dots and Suiki logo center. Used on the customer scan page, merchant program detail, and reward claim screens.

### Props

```typescript
interface BeautifulQRProps {
  /** The string value to encode in the QR code. */
  value: string;
  /**
   * Pixel size of the rendered QR square.
   * @default 240
   */
  size?: number;
  /**
   * Color of the QR dots.
   * @default "--color-primary" (#4ade80)
   */
  color?: string;
  /**
   * Background color.
   * @default "transparent"
   */
  bgColor?: string;
  /**
   * Whether to show the Suiki leaf logo in the center.
   * @default true
   */
  showLogo?: boolean;
  /**
   * Alt text describing what the QR encodes — required for accessibility.
   * @example "QR code for wallet address 0x123...abc"
   */
  alt: string;
  /** Additional wrapper classes. */
  className?: string;
}
```

### Tailwind Classes

```
/* Wrapper — glass card framing the QR code */
wrapper: "glass-card p-4 flex items-center justify-center"

/* QR image/canvas itself — no additional classes; size controlled by prop */
```

### Accessibility

- Wrap the QR canvas/SVG in a `<figure>` with `<figcaption>` containing the `alt` text
- `<figcaption className="sr-only">` hides caption visually while exposing it to screen readers
- If `value` is a URL, also render a visually-hidden `<a href={value}>Open link</a>` so keyboard users can activate it

### States

| State | Visual |
|-------|--------|
| Loading | `glass-card` wrapper with centered spinner (`animate-spin` on a `--color-primary` ring) |
| Loaded | QR code renders inside glass card |
| Error | "Could not generate QR code" error text in `--color-error` |

---

## 7. MerchantCard

**File:** `src/components/merchant-card.tsx`

**Purpose:** Expandable accordion card showing a merchant's loyalty program. Collapsed shows merchant name, emoji, and category. Expanded reveals the stamp grid, progress bar, and "Show QR" CTA.

### Props

```typescript
interface MerchantCardProps {
  /** Merchant program unique ID. */
  programId: string;
  /** Merchant display name. */
  merchantName: string;
  /**
   * Merchant's chosen stamp emoji.
   * @example "☕"
   */
  stampEmoji: string;
  /** Merchant category for the subtitle line (e.g. "Coffee & Drinks"). */
  category: string;
  /** Total stamps required to complete the card. */
  totalStamps: number;
  /** Customer's current earned stamp count. */
  earnedStamps: number;
  /**
   * Whether the card starts expanded.
   * @default false
   */
  defaultExpanded?: boolean;
  /** Called when "Show QR" button is pressed. */
  onShowQR?: (programId: string) => void;
}
```

### Tailwind Classes

```
/* Card container */
card: "glass-card tap-target"

/* Header row — always visible */
header: "flex items-center gap-3 p-[--spacing-card-padding] cursor-pointer"

/* Merchant emoji avatar */
avatar: "w-12 h-12 rounded-full bg-[--color-bg-elevated]
         flex items-center justify-center text-2xl flex-shrink-0"

/* Merchant name */
name: "text-sm font-semibold text-[--color-text-primary]"

/* Category subtitle */
category: "text-xs text-[--color-text-secondary]"

/* Chevron icon — rotates 180° when expanded */
chevron-collapsed: "text-[--color-text-muted] transition-transform duration-[--duration-normal]"
chevron-expanded: "rotate-180"

/* Expanded content — revealed below header */
expanded-content: "px-[--spacing-card-padding] pb-[--spacing-card-padding]
                   border-t border-[--color-border-subtle] pt-3"

/* "Show QR" CTA button */
qr-button: "mt-3 w-full py-2.5 px-4 rounded-[--radius-button]
             bg-[--color-primary] text-[--color-bg-base]
             text-sm font-semibold tap-target"
```

### Accessibility

- `<article>` element for each card
- Header row is a `<button>` with `aria-expanded={isExpanded}` and `aria-controls="card-{programId}-content"`
- Expanded panel: `id="card-{programId}-content"` with `role="region"` and `aria-labelledby="card-{programId}-header"`
- Chevron icon: `aria-hidden="true"`

### States

| State | Visual |
|-------|--------|
| Collapsed | Header row only, chevron points right |
| Expanded | Stamp grid + progress bar + QR button visible, chevron rotated 180° |
| Press | `scale(0.97)` on the entire card via `.tap-target:active` |
| Hover | `--glass-bg-hover`, border brightens (via `.glass-card:hover`) |

### Animation

- Expand/collapse: CSS `max-height` transition, `duration-[--duration-normal]` `ease-[--ease-out]`
- Chevron rotation: `transition-transform duration-[--duration-normal]`

---

## 8. SearchBar

**File:** `src/components/search-bar.tsx`

**Purpose:** Glassmorphic full-width search input for merchant discovery. Shows a search icon on the left and an optional clear button on the right when text is entered.

### Props

```typescript
interface SearchBarProps {
  /** Controlled input value. */
  value: string;
  /** Called on every keystroke. */
  onChange: (value: string) => void;
  /** Placeholder text. Default: "Search merchants..." */
  placeholder?: string;
  /** Called when the user submits (Enter key or form submit). */
  onSubmit?: (value: string) => void;
  /** Whether the input is loading results (shows spinner). Default: false. */
  isLoading?: boolean;
  /** Additional wrapper classes. */
  className?: string;
}
```

### Tailwind Classes

```
/* Outer wrapper — provides the glass card frame */
wrapper: "relative flex items-center glass-card px-4 py-3 gap-3"

/* Search icon — left side */
search-icon: "text-[--color-text-muted] flex-shrink-0"

/* Input element — transparent, full width */
input: "flex-1 bg-transparent text-[--color-text-primary] text-sm
        placeholder:text-[--color-text-muted]
        outline-none border-none
        caret-[--color-primary]"

/* Focus ring — applied to wrapper, not input, so the glass card glows */
wrapper-focus-within: "ring-2 ring-[--color-border-strong]
                        transition-shadow duration-[--duration-micro]"

/* Clear button — appears when value.length > 0 */
clear-button: "tap-target text-[--color-text-muted] hover:text-[--color-text-primary]
               transition-colors duration-[--duration-micro] flex-shrink-0"

/* Loading spinner */
spinner: "w-4 h-4 rounded-full border-2 border-[--color-border]
          border-t-[--color-primary] animate-spin flex-shrink-0"
```

### Accessibility

- `<form role="search">` wraps the input
- `<label className="sr-only">` with matching `htmlFor` — never rely on placeholder alone
- `aria-busy={isLoading}` on the wrapper when loading
- Clear button: `aria-label="Clear search"`
- Input: `type="search"` for mobile keyboard optimization (shows search action key)

### States

| State | Visual |
|-------|--------|
| Default | `--glass-bg`, muted placeholder, muted icon |
| Focus | `ring-2 ring-[--color-border-strong]` on wrapper, `--color-primary` caret |
| With value | Clear button appears (animated fade-in) |
| Loading | Spinner replaces right icon |

---

## 9. Badge

**File:** `src/components/badge.tsx`

**Purpose:** Small pill badge for notification counts, status labels, and category tags. Three visual variants cover all use cases.

### Props

```typescript
type BadgeVariant = "primary" | "loyalty" | "neutral" | "success" | "error";

interface BadgeProps {
  /** Badge text content. */
  children: React.ReactNode;
  /** Visual style variant. Default: "neutral". */
  variant?: BadgeVariant;
  /**
   * Renders as a dot without text — for notification indicators.
   * When true, children is ignored.
   * @default false
   */
  dot?: boolean;
  /** Additional classes. */
  className?: string;
}
```

### Tailwind Classes

```
/* Base — all badges share these */
base: "inline-flex items-center justify-center
       rounded-[--radius-pill] font-semibold
       text-[11px] tracking-wide"

/* Size — text badge vs dot */
text-size: "px-2 py-0.5 min-w-[1.25rem]"
dot-size: "w-2 h-2"

/* Variant: primary — active states, primary count */
primary: "bg-[--color-primary] text-[--color-bg-base]"

/* Variant: loyalty — stamp counts, reward indicators */
loyalty: "bg-[--color-accent-loyalty] text-[--color-bg-base]"

/* Variant: neutral — category labels, secondary info */
neutral: "bg-[--color-bg-elevated] text-[--color-text-secondary]
          border border-[--color-border-subtle]"

/* Variant: success */
success: "bg-[--color-success] text-[--color-bg-base]"

/* Variant: error */
error: "bg-[--color-error] text-white"
```

### Accessibility

- Notification count badges: `aria-label="{count} notifications"` on the wrapping button, not the badge itself
- Pure-visual badges (decorative category labels): `aria-hidden="true"` if redundant with surrounding text
- Status badges: include in the accessible name of the relevant element

### States

| Variant | Background | Text |
|---------|------------|------|
| primary | `--color-primary` | `--color-bg-base` |
| loyalty | `--color-accent-loyalty` | `--color-bg-base` |
| neutral | `--color-bg-elevated` | `--color-text-secondary` |
| success | `--color-success` | `--color-bg-base` |
| error | `--color-error` | white |

---

## 10. EmptyState

**File:** `src/components/empty-state.tsx`

**Purpose:** Full-section empty state with an emoji illustration, heading, supporting text, and optional CTA button. Shown when a list has no items (no cards, no search results, etc.).

### Props

```typescript
interface EmptyStateProps {
  /**
   * Large emoji used as the illustration.
   * @example "🎴" for no cards, "🔍" for no search results
   */
  emoji: string;
  /** Primary heading. */
  heading: string;
  /** Supporting body text. */
  description: string;
  /** CTA button label — omit to show no button. */
  ctaLabel?: string;
  /** CTA button handler. */
  onCta?: () => void;
  /** CTA href — renders as `<Link>` if provided instead of `<button>`. */
  ctaHref?: string;
  /** Additional wrapper classes. */
  className?: string;
}
```

### Tailwind Classes

```
/* Outer wrapper — centered column */
wrapper: "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"

/* Emoji illustration */
emoji: "text-6xl leading-none select-none"

/* Heading */
heading: "text-lg font-semibold text-[--color-text-primary]"

/* Description */
description: "text-sm text-[--color-text-secondary] max-w-[260px] leading-relaxed"

/* CTA button */
cta: "tap-target mt-2 px-6 py-3 rounded-[--radius-button]
      bg-[--color-primary] text-[--color-bg-base]
      text-sm font-semibold
      transition-opacity duration-[--duration-micro]
      hover:opacity-90"
```

### Accessibility

- `aria-live="polite"` on the wrapper — announces the empty state to screen readers when it appears after a data fetch
- Emoji illustration: `aria-hidden="true"` — the heading provides context
- CTA: descriptive label (e.g. "Browse merchants" not just "Get started")

### States

| State | Visual |
|-------|--------|
| Default | Emoji + heading + description, no CTA |
| With CTA | Adds `--color-primary` button below description |
| CTA loading | Button shows `opacity-50 pointer-events-none` while async action runs |

---

## Token Quick Reference

Use these in Tailwind v4 bracket syntax anywhere in components:

| Token | Bracket Syntax | Usage |
|-------|---------------|-------|
| `--color-primary` | `bg-[--color-primary]` / `text-[--color-primary]` | CTAs, active nav, filled stamps |
| `--color-primary-light` | `ring-[--color-primary-light]` | Focus rings, hover glow |
| `--color-accent-loyalty` | `bg-[--color-accent-loyalty]` | Earned stamps, reward badges |
| `--color-accent-loyalty-muted` | `bg-[--color-accent-loyalty-muted]` | Empty stamp slots |
| `--color-bg-base` | `bg-[--color-bg-base]` | Page background |
| `--color-bg-surface` | `bg-[--color-bg-surface]` | Card surfaces |
| `--color-bg-elevated` | `bg-[--color-bg-elevated]` | Modals, sheets |
| `--glass-bg` | (use `.glass-card` class) | Glassmorphic containers |
| `--color-border` | `border-[--color-border]` | Standard card borders |
| `--color-border-subtle` | `border-[--color-border-subtle]` | Dividers, inactive slots |
| `--color-border-strong` | `ring-[--color-border-strong]` | Focus states |
| `--color-text-primary` | `text-[--color-text-primary]` | Body text |
| `--color-text-secondary` | `text-[--color-text-secondary]` | Captions, subtitles |
| `--color-text-muted` | `text-[--color-text-muted]` | Placeholders, inactive |
| `--radius-card` | `rounded-[--radius-card]` | Cards, modals |
| `--radius-button` | `rounded-[--radius-button]` | Buttons |
| `--radius-input` | `rounded-[--radius-input]` | Inputs, search bars |
| `--radius-pill` | `rounded-[--radius-pill]` | Badges, dots |
| `--nav-height` | `h-[--nav-height]` | Bottom nav |
| `--spacing-page-x` | `px-[--spacing-page-x]` | Page horizontal padding |
| `--spacing-card-padding` | `p-[--spacing-card-padding]` | Card internal padding |
| `--duration-micro` | `duration-[--duration-micro]` | Press/hover transitions |
| `--duration-normal` | `duration-[--duration-normal]` | Card expand/collapse |
| `--ease-out` | `ease-[--ease-out]` | All entrance animations |
