# Suiki — UI Design Specification (Sprint 3)

**Status:** Authoritative
**Date:** 2026-03-25
**Scope:** Issues 8, 9, 10, 11, 12 — QR components, merchant pages, customer pages, stamp flow, landing page
**Audience:** Frontend implementation agent

---

## How to read this document

- Every component section lists: structure, exact Tailwind class patterns, all named states, micro-interactions, and accessibility requirements.
- CSS variable references use Tailwind v4 bracket syntax: `bg-[--color-bg-surface]`.
- "Thumb zone" = bottom 40% of viewport — all primary CTAs must live there.
- Filipino copy strings are canonical. Do not substitute English equivalents.
- The existing `Button`, `Input`, and `WalletGuard` components must be composed where noted — do not re-implement their internals.

---

## Design Tokens Quick Reference

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#3b82f6` | CTAs, active states |
| `--color-primary-light` | `#60a5fa` | Hover/focus rings |
| `--color-primary-dark` | `#2563eb` | Pressed state |
| `--color-accent-loyalty` | `#f59e0b` | Stamp gold — filled slots, progress, rewards |
| `--color-accent-loyalty-muted` | `#78350f` | Empty stamp slots |
| `--color-bg-base` | `#0f172a` | Page background |
| `--color-bg-surface` | `#1e293b` | Card surfaces |
| `--color-bg-elevated` | `#334155` | Modals, sheets, dialogs |
| `--color-border` | `#475569` | Card borders |
| `--color-border-subtle` | `#1e293b` | Inactive slot outlines |
| `--color-text-primary` | `#f1f5f9` | Body text |
| `--color-text-secondary` | `#94a3b8` | Captions, labels |
| `--color-text-muted` | `#475569` | Placeholders, disabled |
| `--color-success` | `#22c55e` | Stamp earned, confirmed |
| `--color-error` | `#ef4444` | Errors, failures |
| `--color-warning` | `#f59e0b` | Rate limit, low gas |
| `--radius-base` | `0.75rem` | Cards, inputs |
| `--radius-pill` | `9999px` | Badges, stamp dots |

---

## Button Variant Corrections

The existing `button.tsx` uses hardcoded Tailwind color names instead of CSS variables. Until it is updated, compose around it by passing `className` overrides for the loyalty variant. A fourth variant — `loyalty` — should be added for reward CTAs:

```
// Proposed addition to VARIANT_CLASSES in button.tsx
loyalty: "bg-[--color-accent-loyalty] text-[--color-bg-base] hover:bg-amber-400 focus-visible:ring-[--color-accent-loyalty]"
```

The primary variant should reference `--color-primary` rather than `indigo-600`. Note this for the Frontend agent but do not block on it — use `className` prop to override per component.

---

## Part 1 — QR Components (Issue 9)

---

### 1.1 QR Code Display (`qr-code.tsx`)

**Purpose:** Render a scannable QR code with an optional label below. Used on the merchant program detail page and the customer scan page.

#### Props

```typescript
interface QRCodeProps {
  value: string;           // The encoded string (wallet address, program ID, etc.)
  label?: string;          // Text rendered beneath the QR. Default: none.
  size?: "sm" | "md" | "lg"; // sm=160px, md=220px (default), lg=280px
  className?: string;
}
```

#### Structure

```
<div role="img" aria-label={`QR code: ${label ?? value}`}>
  <div>   ← outer container, centers content, handles background
    <div> ← white QR background frame (QR codes need white padding)
      <QRCodeSVG ... />   ← use qrcode.react library
    </div>
    {label && <p>label text</p>}
  </div>
</div>
```

#### Tailwind Classes

```
// Outer wrapper — centers horizontally, provides accessible label
"flex flex-col items-center gap-3"

// White frame — QR codes require a white surround to scan reliably
// The padding-4 ensures scanner-friendly quiet zone
"rounded-[--radius-base] bg-white p-4 shadow-lg"

// Size variants (applied to the frame):
sm:  "w-[168px] h-[168px]"   // QR canvas = 160px
md:  "w-[228px] h-[228px]"   // QR canvas = 220px (default)
lg:  "w-[288px] h-[288px]"   // QR canvas = 280px

// Label text
"text-sm font-medium text-[--color-text-secondary] text-center max-w-[240px]"
```

#### States

| State | Behavior |
|---|---|
| Default | QR renders immediately; no skeleton needed as value is always present |
| No value | Render a grey placeholder box with `"—"` text; should not occur in practice |
| Print/share | No special state needed in Sprint 3 |

#### Micro-interactions

- On mount: fade-in with `transition-opacity duration-300 opacity-0` → `opacity-100`. Use a `useEffect` to add the class after mount to avoid flash.
- Tapping the QR on mobile does nothing (it is not interactive). Set `pointer-events-none` on the `<QRCodeSVG>` itself to prevent accidental selection.

#### Accessibility

- Outer wrapper uses `role="img"` with a descriptive `aria-label`.
- The label `<p>` is `aria-hidden="true"` since the information is captured in `aria-label` above.

---

### 1.2 QR Scanner (`qr-scanner.tsx`)

**Purpose:** Camera viewfinder UI for scanning QR codes. Used by merchants to scan customer QRs and by customers to scan merchant program QRs.

#### Props

```typescript
interface QRScannerProps {
  onScan: (result: string) => void;   // Called once per unique decode
  onError?: (error: Error) => void;
  label?: string;                      // Instruction text above viewfinder
  isLoading?: boolean;                 // Externally-controlled loading overlay
}
```

#### Structure

```
<div>                              ← page-level container
  <p>instruction label</p>         ← above viewfinder
  <div>                            ← viewfinder frame (square, aspect-ratio: 1)
    <video />                      ← camera stream
    <div>                          ← corner bracket overlay (SVG or CSS)
    <div>                          ← scanning animation line
  </div>
  {permission denied state}
  {loading overlay}
</div>
```

#### Tailwind Classes — Default (scanning)

```
// Page container
"flex flex-col items-center gap-4 px-4"

// Instruction label
"text-base font-medium text-[--color-text-secondary] text-center"

// Viewfinder outer (forces 1:1 aspect ratio, max width 300px)
"relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden bg-black"

// Camera video element — fills frame
"absolute inset-0 w-full h-full object-cover"

// Corner bracket overlay (four corners, CSS-only via pseudo-elements or inline SVG)
// Each bracket: 24px × 24px, border-[--color-accent-loyalty], border-2
// Positioned: absolute, corners via top-0/bottom-0/left-0/right-0 with offset-2
"absolute inset-2 pointer-events-none"

// Scanning animation line — horizontal bar that sweeps top to bottom
"absolute left-2 right-2 h-0.5 bg-[--color-accent-loyalty] opacity-75"
// Animate: translateY from top (8px) to bottom (288px), 2s linear infinite
// CSS: animate-[scan_2s_linear_infinite]  — define in globals.css:
//   @keyframes scan { 0%{top:8px} 100%{top:calc(100%-8px)} }
```

#### Corner Brackets (inline SVG pattern)

Render four absolutely-positioned SVG elements at each corner of the viewfinder. Each is a 24×24 SVG with two perpendicular lines forming an "L" shape. Color: `--color-accent-loyalty`. This avoids CSS border-corner hacks and renders crisply on all pixel densities.

```
// Top-left corner
<svg className="absolute top-2 left-2 w-6 h-6" ...>
  <path d="M 0 24 L 0 0 L 24 0" stroke="var(--color-accent-loyalty)" strokeWidth="3" fill="none" />
</svg>
// Top-right: mirror horizontally
// Bottom-left: mirror vertically
// Bottom-right: mirror both
```

#### States

**Default (scanning):**
- Camera feed active, scan line animating.
- Label: `"I-scan ang QR code"` (or prop value).

**Loading (isLoading=true):**
```
// Overlay covers the viewfinder
"absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl"

// Spinner — pure CSS
<div className="h-10 w-10 rounded-full border-4 border-[--color-bg-elevated] border-t-[--color-primary] animate-spin" />
<p className="mt-3 text-sm text-[--color-text-secondary]">Nagpo-proseso...</p>
```

**Permission Denied:**
```
// Replace entire viewfinder with this panel
"flex flex-col items-center justify-center gap-4 w-full max-w-[300px] aspect-square rounded-2xl bg-[--color-bg-surface] border border-[--color-border] px-6"

// Camera-off icon (inline SVG, 40×40, color: --color-error)
// Heading
"text-base font-semibold text-[--color-text-primary] text-center"
// → "Hindi pinayagan ang camera"

// Body
"text-sm text-[--color-text-secondary] text-center"
// → "Pumunta sa Settings > Apps > [Browser] > Permissions para payagan ang camera."

// Retry button (existing Button component, variant="secondary")
<Button variant="secondary" onClick={onRetry}>Subukan Ulit</Button>
```

**Scan Success (brief flash before parent handles navigation):**
- Pause the scan line animation.
- Flash the viewfinder border to `--color-success` for 400ms using a transient class.
- Emit `onScan(result)` — the parent handles all subsequent UI.

#### Accessibility

- `<video>` element: `aria-label="Camera viewfinder for QR scanning"`, `aria-live` not needed (events drive state, not polled text).
- The permission denied state has `role="alert"` on its container.
- The loading overlay has `aria-busy="true"` and `aria-label="Nagpo-proseso ng QR"`.

#### Implementation Notes

- Use the `html5-qrcode` or `@zxing/browser` library. Do not use a native approach requiring WASM unless it is already in the bundle.
- Wrap camera access in a `try/catch`; map `NotAllowedError` to the permission denied state, all other errors to `onError`.
- Debounce `onScan` to 1500ms to prevent duplicate fires on a single QR code exposure.
- On component unmount, stop all camera tracks (`stream.getTracks().forEach(t => t.stop())`).

---

### 1.3 Stamp Card Display (`stamp-card-display.tsx`)

**Purpose:** The hero UI element of the entire product. Shows a merchant's loyalty card with branding, current stamp count, progress, and a redeem CTA when the card is complete.

#### Props

```typescript
interface StampCardDisplayProps {
  merchantName: string;
  logoUrl?: string;
  stampsRequired: number;
  stampsEarned: number;
  rewardDescription: string;
  onRedeem?: () => void;       // Only relevant when card is full
  isRedeeming?: boolean;       // Loading state for redeem action
  variant?: "customer" | "merchant";  // customer = full interactive; merchant = display-only preview
}
```

#### Visual Design

The stamp card is a physical card metaphor. It must feel tactile and premium despite the simple tech context. Key visual decisions:

- **Card ratio:** 3:2 landscape (like a physical loyalty card), width 100%, max-width 380px.
- **Background:** `--color-bg-surface` with a subtle gradient overlay: `from-[--color-bg-surface] to-[#0f1e35]` (a very slightly deeper blue-black).
- **Gold accent border:** `1px solid --color-accent-loyalty` at 30% opacity when incomplete; full opacity and a `ring-2 ring-[--color-accent-loyalty]/40` glow when complete.
- **Merchant logo:** Circular, 48×48px, positioned top-left. Falls back to a colored initial avatar using the first letter of `merchantName`.
- **Stamp slots:** Rendered by `StampProgress` (see 1.4).

#### Structure

```
<article aria-label={`${merchantName} loyalty card, ${stampsEarned} of ${stampsRequired} stamps`}>
  <div>                             ← card frame
    <header>                        ← merchant identity row
      <MerchantLogo />
      <div>
        <h3>merchantName</h3>
        <p>rewardDescription</p>
      </div>
    </header>

    <StampProgress                  ← see component 1.4
      total={stampsRequired}
      earned={stampsEarned}
    />

    <footer>                        ← count + optional redeem
      <p>{stampsEarned}/{stampsRequired} stamps</p>
      {isComplete && <RedeemButton />}
    </footer>
  </div>
</article>
```

#### Tailwind Classes

```
// Article (accessible landmark, no visual role)
"w-full max-w-[380px] mx-auto"

// Card frame
"relative rounded-2xl border p-5 flex flex-col gap-4 overflow-hidden"
"bg-gradient-to-br from-[--color-bg-surface] to-[#0f1e35]"
// Incomplete: "border-[--color-accent-loyalty]/30"
// Complete:   "border-[--color-accent-loyalty] ring-2 ring-[--color-accent-loyalty]/40 shadow-[0_0_24px_rgba(245,158,11,0.2)]"
// Transition: "transition-all duration-500"

// Decorative gold shimmer strip (aria-hidden) — thin 2px bar at top of card
"absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[--color-accent-loyalty] to-transparent"
// Only rendered when isComplete. Animate with opacity pulse.

// Header row
"flex items-center gap-3"

// Logo circle (when logoUrl is present)
"h-12 w-12 rounded-full object-cover border-2 border-[--color-border] flex-shrink-0"

// Initial avatar (fallback)
"h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0"
"bg-[--color-primary] text-white text-lg font-bold border-2 border-[--color-border]"

// Merchant name
"text-base font-semibold text-[--color-text-primary] leading-tight"

// Reward description (below name)
"text-xs text-[--color-text-secondary] leading-snug"
// Prefix with trophy emoji: "🏆 {rewardDescription}" — this is the one permitted emoji use, as it communicates reward visually without text

// Footer row
"flex items-center justify-between mt-1"

// Stamp count label
"text-sm font-medium text-[--color-text-secondary]"

// Redeem button (when complete)
// Uses existing Button component with loyalty variant override:
<Button
  className="bg-[--color-accent-loyalty] text-[--color-bg-base] hover:bg-amber-400 text-sm px-4 py-2 rounded-[--radius-pill] font-bold"
  onClick={onRedeem}
  disabled={isRedeeming}
  aria-label="I-redeem ang reward"
>
  {isRedeeming ? "Nagre-redeem..." : "I-Redeem!"}
</Button>
```

#### States

| State | Visual |
|---|---|
| Incomplete (0 to N-1 stamps) | Muted gold border (30% opacity), no glow, no redeem button |
| Complete | Full gold border, glow `shadow`, shimmer strip, redeem button appears |
| Redeeming | Redeem button shows spinner text "Nagre-redeem...", `disabled`, card border stays gold |
| Redeemed (post-success) | Parent navigates away or shows success state; card itself does not render a redeemed state |
| Loading skeleton | Show while merchant data is fetching (see skeleton spec below) |

#### Loading Skeleton

```
// Same card frame dimensions, no content
"rounded-2xl border border-[--color-border] p-5 flex flex-col gap-4 animate-pulse"
"bg-[--color-bg-surface]"

// Logo placeholder
"h-12 w-12 rounded-full bg-[--color-bg-elevated]"

// Name placeholder
"h-4 w-32 rounded bg-[--color-bg-elevated]"

// Reward placeholder
"h-3 w-48 rounded bg-[--color-bg-elevated]"

// Stamp row placeholder
"h-8 w-full rounded bg-[--color-bg-elevated]"
```

#### Micro-interactions

- When `stampsEarned` increases (new stamp earned): the newly-filled stamp slot scales from 0.5 to 1.0 with a spring feel (`transition-transform duration-300 ease-out`) and the card border transitions from muted to full gold if this completes the card.
- The complete-state gold glow uses a CSS `@keyframes pulse-glow` to breathe: shadow oscillates between `rgba(245,158,11,0.15)` and `rgba(245,158,11,0.35)` on a 2.5s loop. Define in globals.css.
- The redeem button entrance (when card completes): slides up 8px from `translate-y-2 opacity-0` to `translate-y-0 opacity-100` over 400ms.

#### Accessibility

- `<article>` with a descriptive `aria-label` captures all essential info for screen readers.
- The stamp count in the footer is `aria-hidden="true"` because it is redundant with the `aria-label` on the article.
- Redeem button must have `aria-label="I-redeem ang reward: {rewardDescription}"` (includes reward name).
- When `isRedeeming`, the button gets `aria-busy="true"`.

---

### 1.4 Stamp Progress (`stamp-progress.tsx`)

**Purpose:** Visual row of stamp slots showing how many stamps have been collected. The most-scanned element in the entire product — must be immediately legible at a glance.

#### Props

```typescript
interface StampProgressProps {
  total: number;             // Maximum stamps (1–100)
  earned: number;            // Stamps collected so far
  animate?: boolean;         // Whether to animate the latest fill (default: false)
  size?: "sm" | "md";       // sm = used inside stamp card; md = used standalone
}
```

#### Visual Design

Each stamp slot is a diamond (rotated square) — a visual callback to the SUI blockchain logo's geometric aesthetic. Filled slots are gold (`--color-accent-loyalty`); empty slots are the muted dark amber (`--color-accent-loyalty-muted`) with a subtle border.

For `total > 10`: render in two rows, wrapping. For `total > 20`: switch to a compact progress bar mode (see below).

#### Layout Modes

**Slot mode (total 1–20):**

```
// Slots container
"flex flex-wrap gap-1.5 justify-start"

// Individual slot (both filled and empty)
"relative flex items-center justify-center"
// Size sm: "w-6 h-6"
// Size md: "w-8 h-8"

// The diamond shape: a div rotated 45 degrees
"rounded-sm rotate-45 transition-all duration-300"
// Size sm inner: "w-3.5 h-3.5"
// Size md inner: "w-5 h-5"

// Filled slot
"bg-[--color-accent-loyalty] shadow-[0_0_6px_rgba(245,158,11,0.5)]"

// Empty slot
"bg-[--color-accent-loyalty-muted] border border-[--color-border-subtle]"

// Newly-filled slot (animate=true, last earned slot)
"scale-0" → "scale-100"   // CSS transition on mount
```

**Progress bar mode (total > 20):**

When more than 20 stamps are needed, the individual slot grid becomes impractical. Switch to a labeled progress bar.

```
// Container
"flex flex-col gap-1.5 w-full"

// Bar track
"w-full rounded-[--radius-pill] h-3 bg-[--color-accent-loyalty-muted]"

// Bar fill (width = earned/total * 100%)
"h-full rounded-[--radius-pill] bg-[--color-accent-loyalty] transition-all duration-500 ease-out"

// Label below bar
"flex justify-between text-xs text-[--color-text-secondary]"
// Left: "{earned} stamps"
// Right: "{total - earned} pa"  (e.g., "7 pa" = 7 more to go)
```

#### States

| State | Behavior |
|---|---|
| 0 earned | All slots empty/muted |
| Partial | N filled (gold) + (total-N) empty (muted) |
| Complete | All slots gold + `shadow` glow on every slot |
| Animate new stamp | The `earned`-th slot plays scale-in animation when `animate=true` |

#### Accessibility

- Wrap in `<div role="meter" aria-valuenow={earned} aria-valuemin={0} aria-valuemax={total} aria-label={`${earned} ng ${total} stamps`}>`.
- Individual slot `<div>`s are `aria-hidden="true"` — the meter role conveys the full information.

---

## Part 2 — Merchant Pages (Issue 8)

---

### 2.1 Navigation Header

**Used on:** All authenticated pages (`/merchant`, `/merchant/create`, `/merchant/[programId]`, `/customer`, `/customer/scan`).

#### Structure

```
<header>
  <div>                    ← inner max-width container
    <a href="/">           ← logo/brand link
      <span>Suiki</span>   ← wordmark text
    </a>
    <WalletStatus />       ← right side — connected address or connect button
  </div>
</header>
```

#### Tailwind Classes

```
// Header bar
"sticky top-0 z-40 w-full border-b border-[--color-border-subtle] bg-[--color-bg-base]/90 backdrop-blur-sm"

// Inner container
"mx-auto flex h-14 max-w-lg items-center justify-between px-4"

// Logo text
"text-lg font-bold text-[--color-text-primary] tracking-tight"
// The "S" could use text-[--color-accent-loyalty] for brand accent: "Su<span class='text-[--color-accent-loyalty]'>iki</span>"

// Wallet status — connected state
"flex items-center gap-2 rounded-[--radius-pill] bg-[--color-bg-surface] border border-[--color-border] px-3 py-1.5"

// Wallet dot indicator
"h-2 w-2 rounded-full bg-[--color-success]"

// Wallet address text (truncated: first 4 + ... + last 4 chars)
"text-xs font-address text-[--color-text-secondary]"   // font-address is the monospace class from globals.css

// Wallet status — disconnected state
// Show the existing ConnectWallet button component, small size
```

#### States

| State | Display |
|---|---|
| Connected | Green dot + truncated address (e.g., `0x1a2b...f3c4`) |
| Disconnected | `ConnectWallet` button (small, `variant="ghost"` override) |
| Connecting | Spinner dot + "Nagkokonekta..." text |

#### Accessibility

- `<header>` element with `role="banner"`.
- Logo link: `aria-label="Suiki — bumalik sa home"`.
- Wallet address: `title` attribute with full address for tooltip on hover.

---

### 2.2 Merchant Dashboard (`/merchant` page)

**Purpose:** List all of a merchant's stamp programs. Primary CTA to create a new one.

#### Page Layout

```
<WalletGuard heading="Mag-login para sa inyong tindahan" description="Kailangan ang wallet para pamahalaan ang inyong mga stamp program.">
  <div>                            ← page root
    <NavigationHeader />
    <main>
      <h1>Aking mga Program</h1>
      {state === "loading"  && <ProgramListSkeleton />}
      {state === "empty"    && <EmptyState />}
      {state === "populated" && <ProgramList programs={programs} />}
    </main>
    <div>                          ← sticky bottom CTA
      <Button ...>+ Gumawa ng Program</Button>
    </div>
  </div>
</WalletGuard>
```

#### Tailwind Classes — Page Root

```
// Page wrapper — full height, flex column
"flex min-h-[100dvh] flex-col bg-[--color-bg-base]"

// Main content — scrollable, padded, with bottom padding for sticky CTA
"flex-1 overflow-y-auto px-4 pb-28 pt-4"

// Page heading
"text-xl font-bold text-[--color-text-primary] mb-4"

// Sticky bottom CTA wrapper
"fixed bottom-0 left-0 right-0 z-30 flex justify-center bg-[--color-bg-base]/95 backdrop-blur-sm px-4 pb-6 pt-3 border-t border-[--color-border-subtle]"

// CTA button — full width, max-width constrained
"w-full max-w-lg"
// Uses Button component with className override to match design token:
// "bg-[--color-primary] hover:bg-[--color-primary-light] text-white"
```

#### Program List Item

Each program is a tappable row card:

```
// Card
"flex items-center gap-4 rounded-[--radius-base] border border-[--color-border] bg-[--color-bg-surface] p-4 active:bg-[--color-bg-elevated] transition-colors"

// Logo
"h-10 w-10 rounded-full object-cover flex-shrink-0"
// or initial avatar (same spec as StampCard, smaller size)

// Text column
"flex-1 min-w-0"

// Program name
"text-sm font-semibold text-[--color-text-primary] truncate"

// Stat line: "{N} customers • {M} stamps issued"
"text-xs text-[--color-text-secondary] mt-0.5"

// Chevron
"h-5 w-5 text-[--color-text-muted] flex-shrink-0"
// inline SVG: right-pointing chevron
```

#### Empty State

```
// Container — centered, dashed border box
"flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[--color-border] px-6 py-12 text-center"

// Icon — store/shop SVG, 48×48
"text-[--color-text-muted]"

// Heading
"text-base font-semibold text-[--color-text-primary]"
// → "Walang programa pa."

// Body
"text-sm text-[--color-text-secondary] leading-relaxed"
// → "Gumawa ng unang loyalty stamp program para sa inyong tindahan."
```

#### List Skeleton (loading state)

Three skeleton cards, same dimensions as a program card, with `animate-pulse` children:

```
// Per skeleton card — same layout as real card
"flex items-center gap-4 rounded-[--radius-base] border border-[--color-border] bg-[--color-bg-surface] p-4 animate-pulse"

// Logo placeholder
"h-10 w-10 rounded-full bg-[--color-bg-elevated] flex-shrink-0"

// Name placeholder
"h-4 w-36 rounded bg-[--color-bg-elevated]"

// Stat placeholder
"h-3 w-48 rounded bg-[--color-bg-elevated] mt-1"
```

#### Accessibility

- `<main>` with `id="main-content"` and skip link from header.
- `<h1>` is the page heading.
- Program cards are `<a>` elements (not `<div>` + `onClick`) for keyboard navigation and screen-reader link announcement.
- Empty state container: `role="status"` so screen readers announce it when it appears.
- CTA button: `aria-label="Gumawa ng bagong stamp program"`.

---

### 2.3 Create Program Form (`/merchant/create` page)

#### Page Layout

```
<WalletGuard>
  <div>
    <NavigationHeader />
    <main>
      <a href="/merchant">← Bumalik</a>   ← back nav
      <h1>Bagong Stamp Program</h1>
      <form>
        <Input label="Pangalan ng Tindahan" ... />
        <Input label="Logo URL (opsyonal)" ... />
        <StampStepper />                          ← custom numeric stepper
        <Input label="Ano ang reward?" ... />
        <RewardPreview />                          ← live preview of stamp card
      </form>
    </main>
    <div>                                          ← sticky CTA
      <Button type="submit">Gumawa ng Program</Button>
    </div>
  </div>
</WalletGuard>
```

#### Tailwind Classes — Form Layout

```
// Page root (same as dashboard)
"flex min-h-[100dvh] flex-col bg-[--color-bg-base]"

// Main area
"flex-1 overflow-y-auto px-4 pb-32 pt-4"

// Back link
"inline-flex items-center gap-1.5 text-sm text-[--color-text-secondary] mb-5 hover:text-[--color-text-primary] transition-colors"
// Chevron-left SVG before text

// Page heading
"text-xl font-bold text-[--color-text-primary] mb-6"

// Form
"flex flex-col gap-5"

// Section divider (thin line between fields and preview)
"border-t border-[--color-border-subtle] my-2"

// Helper text below a field
"text-xs text-[--color-text-muted] mt-1"
```

#### Stamp Count Stepper

A custom stepper because a plain `<input type="number">` has poor mobile UX (no large tap targets, system numeric keyboard pops up unexpectedly).

```
// Stepper container
"flex flex-col gap-1"

// Label (reuse same style as Input label)
"text-sm font-medium text-slate-300"
// → "Ilang stamps bago ma-reward?"

// Controls row
"flex items-center gap-3"

// Decrement button
"flex h-10 w-10 items-center justify-center rounded-[--radius-base] bg-[--color-bg-elevated] border border-[--color-border] text-[--color-text-primary] text-xl font-bold active:bg-[--color-bg-surface] select-none"
// Content: "−" (minus sign, not hyphen)
// aria-label="Bawasan ang bilang ng stamps"
// disabled when value === 1

// Count display
"min-w-[3.5rem] text-center text-2xl font-bold text-[--color-accent-loyalty] select-none"

// Increment button
"flex h-10 w-10 items-center justify-center rounded-[--radius-base] bg-[--color-bg-elevated] border border-[--color-border] text-[--color-text-primary] text-xl font-bold active:bg-[--color-bg-surface] select-none"
// Content: "+"
// aria-label="Dagdagan ang bilang ng stamps"
// disabled when value === 100

// Hint text
"text-xs text-[--color-text-muted]"
// → "Mula 1 hanggang 100 stamps"
```

#### Live Preview

Below the form fields, show a read-only `StampCardDisplay` that updates as the user types. This builds confidence — Maria can see what her customers will see.

```
// Preview section
"flex flex-col gap-3 mt-4"

// Label
"text-sm font-medium text-[--color-text-secondary]"
// → "Preview:"

// StampCardDisplay with variant="merchant" and dummy stampsEarned=0
```

#### Form States

| State | Behavior |
|---|---|
| Pristine | CTA button enabled (fields start with sensible defaults: stamps=10) |
| Validation error | Input component error prop populates; button stays enabled (validate on submit) |
| Submitting | Button shows `"Ginagawa..."` text + spinner, `disabled`, form fields `disabled` |
| Success | Brief `"Tagumpay!"` toast (see toast spec in Part 4), then `router.push('/merchant/[newProgramId]')` |
| TX Error | Toast with error message + retry option |

#### Validation Rules

| Field | Requirement | Error message |
|---|---|---|
| Pangalan ng Tindahan | Required, 2–50 chars | "Kailangan ang pangalan ng tindahan." |
| Logo URL | Optional, must be valid URL if provided | "Hindi valid ang URL. Subukan ulit." |
| Stamps required | 1–100 | Enforced by stepper; no text error needed |
| Reward description | Required, 5–100 chars | "Ilarawan ang reward para sa inyong customers." |

#### Accessibility

- `<form>` has `aria-label="Gumawa ng bagong stamp program"`.
- The stamp stepper uses `role="spinbutton"` with `aria-valuenow`, `aria-valuemin="1"`, `aria-valuemax="100"`, `aria-label="Bilang ng stamps bago ma-reward"`.
- Submit button: `aria-busy="true"` while submitting.
- Validation errors: `role="alert"` on error messages (the existing `Input` component already implements this).

---

### 2.4 Program Detail (`/merchant/[programId]` page)

**Purpose:** The merchant's operational screen — shows the QR code customers scan, program stats, and the CTA to stamp a customer.

#### Page Layout

```
<WalletGuard>
  <div>
    <NavigationHeader />
    <main>
      <ProgramHeader />        ← logo, name, reward
      <QRSection />            ← QRCodeDisplay + instructions
      <StatsSection />         ← customer count, total stamps issued
      <ScanCustomerSection />  ← scanner UI (collapsible, see Issue 10)
    </main>
    <div>                      ← sticky bottom CTA
      <Button>I-Scan ang Customer</Button>
    </div>
  </div>
</WalletGuard>
```

#### Tailwind Classes

```
// Main
"flex-1 overflow-y-auto px-4 pb-28 pt-4 flex flex-col gap-6"

// Program header section
"flex items-center gap-4"

// Logo (larger than list — 56×56)
"h-14 w-14 rounded-full object-cover border-2 border-[--color-border] flex-shrink-0"

// Program name
"text-lg font-bold text-[--color-text-primary]"

// Reward label
"text-sm text-[--color-text-secondary]"

// QR section — centered card
"flex flex-col items-center gap-3 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] py-6 px-4"

// QR instruction text (above QR)
"text-sm font-medium text-[--color-text-secondary] text-center"
// → "Ipakita ang QR na ito sa inyong customers"

// QRCodeDisplay: size="lg" label="Scan para makakuha ng stamps"

// QR instruction text (below QR)
"text-xs text-[--color-text-muted] text-center"
// → "Bawat customer ay i-scan ang QR na ito para ma-record ang kanilang stamp."

// Stats section
"grid grid-cols-2 gap-3"

// Stat card
"flex flex-col gap-1 rounded-[--radius-base] border border-[--color-border] bg-[--color-bg-surface] p-4"

// Stat number
"text-2xl font-bold text-[--color-text-primary]"

// Stat label
"text-xs text-[--color-text-secondary]"
// Labels: "Customers", "Stamps Na-issue"
```

#### States

| State | Behavior |
|---|---|
| Loading | Skeleton for header, QR box (spinner inside), stats (two skeleton cards) |
| Loaded | Full content as described |
| QR Error | "Hindi ma-generate ang QR. I-refresh ang page." inline in QR section |
| Program not found | Full-page error: "Hindi nahanap ang program." + back button |

---

## Part 3 — Merchant Stamp Flow (Issue 10)

The scan customer flow is initiated from the Program Detail page. The merchant taps "I-Scan ang Customer" which reveals the scanner UI in a bottom sheet modal.

---

### 3.1 Bottom Sheet: Scan Customer QR

#### Sheet Structure

```
// Backdrop
"fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
// Animate: opacity 0 → 1 on open (150ms)

// Sheet panel
"fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl border-t border-[--color-border] bg-[--color-bg-elevated]"
// Animate: translateY(100%) → translateY(0) on open (300ms, ease-out)

// Drag handle (decorative)
"mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-[--color-border]"

// Sheet heading
"px-5 text-base font-semibold text-[--color-text-primary] mb-4"
// → "I-Scan ang QR ng Customer"

// QRScanner component inside sheet
"px-4 pb-6"
```

#### After Successful Scan: Confirm Stamp Dialog

When a valid customer QR is scanned, replace the scanner with a confirmation card inside the same sheet:

```
// Confirmation content
"flex flex-col items-center gap-4 px-5 pb-8"

// Customer address (truncated)
"rounded-[--radius-base] bg-[--color-bg-surface] border border-[--color-border] px-4 py-3 w-full"
<p className="text-xs text-[--color-text-secondary]">Customer</p>
<p className="text-sm font-address text-[--color-text-primary]">0x1a2b...f3c4</p>

// Current progress for this customer (if known)
"text-sm text-[--color-text-secondary] text-center"
// → "Kasalukuyang stamps: 3 ng 10"

// Action buttons row
"flex gap-3 w-full"

// Cancel — ghost
<Button variant="ghost" className="flex-1">Kanselahin</Button>

// Confirm stamp — primary (loyalty gold)
<Button className="flex-1 bg-[--color-accent-loyalty] text-[--color-bg-base] font-bold hover:bg-amber-400">
  Mag-Stamp
</Button>
```

#### Stamp Confirming State (TX in flight)

```
// Replace confirm buttons with in-progress indicator
"flex flex-col items-center gap-3 py-2"

// Spinner
"h-8 w-8 rounded-full border-4 border-[--color-bg-surface] border-t-[--color-primary] animate-spin"

// Status text
"text-sm text-[--color-text-secondary] text-center"
// → "Kinokonpirma ang stamp sa SUI..."

// Sub-text (addresses merchant fear of silence)
"text-xs text-[--color-text-muted] text-center"
// → "Mangyaring hintayin. 1–2 segundo lang."
```

#### Success Toast

On TX confirmation, dismiss the sheet and show a toast notification:

```
// Toast — appears at top of screen, slides down
"fixed top-4 left-4 right-4 z-[60] mx-auto max-w-sm"
"flex items-center gap-3 rounded-[--radius-base] border border-[--color-success]/30 bg-[--color-bg-elevated] px-4 py-3 shadow-xl"
// Animate: translateY(-100%) → translateY(0), 250ms ease-out
// Auto-dismiss after 3000ms: translateY(-100%), 250ms ease-in

// Success icon (checkmark circle SVG, 20×20, color: --color-success)
"text-[--color-success] flex-shrink-0"

// Message
"flex flex-col"
<p className="text-sm font-semibold text-[--color-text-primary]">Na-stamp!</p>
<p className="text-xs text-[--color-text-secondary]">Matagumpay na na-record ang stamp.</p>
```

#### Rate Limit Warning

If the merchant has already stamped this customer too recently (enforced by smart contract), show a warning instead of the confirmation:

```
// Replace confirm content with warning panel inside sheet
"flex flex-col items-center gap-3 px-5 pb-8 text-center"

// Warning icon (SVG triangle-exclamation, 40×40, color: --color-warning)

// Heading
"text-base font-semibold text-[--color-text-primary]"
// → "Limitado pa ang Stamp"

// Body
"text-sm text-[--color-text-secondary] leading-relaxed"
// → "Ang customer na ito ay nakatanggap na ng stamp kamakailan. Subukan ulit mamaya."

// Dismiss button
<Button variant="secondary" onClick={closeSheet}>Sige, Naintindihan</Button>
```

#### Accessibility

- Sheet uses `role="dialog"` and `aria-modal="true"` with `aria-labelledby` pointing to the heading.
- Focus is trapped inside the sheet while open. On dismiss, focus returns to the "I-Scan ang Customer" button.
- Backdrop tap dismisses the sheet (only before scan result — after scan, require explicit cancel or confirm).
- Toast: `role="status"` and `aria-live="polite"`.

---

## Part 4 — Customer Pages (Issue 11)

---

### 4.1 Customer Collection (`/customer` page)

**Purpose:** The customer's home — shows all stamp cards they have collected.

#### Page Layout

```
<WalletGuard heading="I-konekta ang wallet mo" description="Para makita ang iyong mga stamps.">
  <div>
    <NavigationHeader />
    <main>
      <h1>Aking mga Stamps</h1>
      {state === "loading"   && <CardGridSkeleton />}
      {state === "empty"     && <EmptyState />}
      {state === "populated" && <CardGrid cards={cards} />}
    </main>
    <div>                     ← sticky bottom CTA
      <Button>I-Scan ang Merchant QR</Button>
    </div>
  </div>
</WalletGuard>
```

#### Card Grid

```
// Grid — single column on 375px; two columns at 480px+
"grid grid-cols-1 gap-4 sm:grid-cols-2"

// Each cell contains a StampCardDisplay (full component, variant="customer")
```

**Sort order:** Complete cards first (they are actionable), then by most-recently-stamped.

#### Empty State (first-time customer)

```
// Container
"flex flex-col items-center gap-5 px-4 py-16 text-center"

// Illustration area — simple SVG stamp / loyalty card graphic, aria-hidden
"h-24 w-24 text-[--color-text-muted]"

// Heading
"text-lg font-semibold text-[--color-text-primary]"
// → "Wala ka pang stamps."

// Body
"text-sm text-[--color-text-secondary] leading-relaxed max-w-[260px]"
// → "I-scan ang QR code ng iyong paboritong tindahan para magsimulang mag-ipon ng stamps."

// Inline CTA (not the sticky one — this is within the empty state)
<Button className="mt-2 bg-[--color-primary] text-white" onClick={navigateToScan}>
  I-Scan Ngayon
</Button>
```

#### Celebration Moment (just earned first stamp)

When the page loads after a successful first stamp, check for a `?stamped=true&program={id}` query param and show a brief celebration banner above the card grid:

```
// Banner
"rounded-[--radius-base] border border-[--color-success]/40 bg-[--color-success]/10 px-4 py-3 flex items-center gap-3 mb-4"
// Auto-dismiss after 5s or on close tap

// Icon: star/sparkle SVG, 20×20, color --color-success

// Text
<p className="text-sm font-semibold text-[--color-success]">Nakakuha ka ng stamp!</p>
<p className="text-xs text-[--color-text-secondary]">Ipagpatuloy para makuha ang iyong reward.</p>
```

#### Card Grid Skeleton

```
// Same grid layout
"grid grid-cols-1 gap-4 sm:grid-cols-2"
// Two skeleton "cards" using the StampCardDisplay skeleton spec (see 1.3)
```

#### Accessibility

- `<main>` contains the primary content.
- `<h1>` is present and visible.
- Each `StampCardDisplay` has its own `<article>` with descriptive `aria-label`.
- Scan CTA: `aria-label="I-scan ang merchant QR para makakuha ng stamps"`.

---

### 4.2 Customer Scan Page (`/customer/scan`)

**Purpose:** The customer scans a merchant QR code, then sees the merchant's stamp program info and their current progress.

#### Page Layout

```
<WalletGuard>
  <div>
    <NavigationHeader />
    <main>
      {state === "scanning"  && <ScannerView />}
      {state === "preview"   && <ProgramPreview />}
      {state === "error"     && <ScanError />}
    </main>
  </div>
</WalletGuard>
```

#### Scanner View

```
// Full-screen-ish scanner centered in page
"flex flex-col items-center gap-6 px-4 pt-6 pb-8"

// Heading
"text-lg font-semibold text-[--color-text-primary] text-center"
// → "I-Scan ang QR ng Tindahan"

// Sub-heading
"text-sm text-[--color-text-secondary] text-center -mt-3"
// → "Hanapin ang QR code na nakadisplay sa tindahan."

// QRScanner component (full size, md viewfinder)

// Cancel button below scanner
<Button variant="ghost" onClick={() => router.back()}>Bumalik</Button>
```

#### Program Preview (after successful scan)

Shown after scanning a valid merchant program QR. The customer sees the program info and their current progress before any action is taken — they do not need to "confirm" anything, stamps are issued by the merchant, not the customer.

```
// Container
"flex flex-col gap-5 px-4 pt-4 pb-8"

// "Program found" label
"text-xs font-semibold uppercase tracking-wider text-[--color-success]"
// → "Nahanap ang Program"

// StampCardDisplay — shows current progress for this customer
// (fetched immediately after scan resolves the program ID)
// While fetching: StampCardDisplay in skeleton state

// Info row: stamps needed for reward
"flex items-center justify-between rounded-[--radius-base] bg-[--color-bg-surface] border border-[--color-border] px-4 py-3"
<p className="text-sm text-[--color-text-secondary]">Para makuha ang reward:</p>
<p className="text-sm font-semibold text-[--color-text-primary]">{remaining} stamps pa</p>

// Action note (customer cannot self-stamp — merchant must scan them)
"rounded-[--radius-base] bg-[--color-bg-elevated] border border-[--color-border-subtle] px-4 py-3 text-sm text-[--color-text-secondary] text-center"
// → "Ipakita ang iyong QR sa merchant para makakuha ng stamp."

// Customer QR code — their wallet-derived QR for the merchant to scan
// Centered, QRCodeDisplay size="md"
// Label below: "Ang inyong QR Code"

// Done button
<Button variant="secondary" className="w-full" onClick={() => router.push('/customer')}>
  Tapos Na
</Button>
```

#### Scan Error State

```
"flex flex-col items-center gap-4 px-4 py-12 text-center"

// Error icon (X in circle, 48×48, --color-error)

// Heading
"text-base font-semibold text-[--color-text-primary]"
// → "Hindi Na-scan"

// Body — varies by error type:
// Invalid QR: "Ang QR na ito ay hindi para sa Suiki. Subukan ang ibang QR."
// Network error: "May problema sa koneksyon. Subukan ulit."
// Program not found: "Hindi nahanap ang stamp program na ito."

// Retry button
<Button onClick={resetToScanner}>Subukan Ulit</Button>
```

---

## Part 5 — Landing Page (Issue 12)

---

### 5.1 Landing Page (`/` page)

**Purpose:** The first screen for all users. Must immediately communicate value to Maria (merchant) and Juan (customer), and get them connected/started with the minimum possible friction.

#### Page Layout

```
<div>
  <LandingHeader />          ← simplified header (no wallet status needed)
  <main>
    <HeroSection />
    <ValuePropSection />
    <CTASection />
    <TrustFooter />
  </main>
</div>
```

#### Tailwind Classes — Page Root

```
// Page
"flex min-h-[100dvh] flex-col bg-[--color-bg-base]"

// Main
"flex-1 flex flex-col"
```

#### Landing Header

```
// Simplified header (no auth-sensitive info)
"flex items-center justify-between px-5 py-4"

// Logo
"text-xl font-bold text-[--color-text-primary]"
// "Sui<span class='text-[--color-accent-loyalty]'>ki</span>"

// Connect wallet button (small)
// If already connected: show truncated address (WalletStatus as in NavigationHeader)
```

#### Hero Section

```
// Hero — fills most of the viewport above the fold
"flex flex-col items-center justify-center text-center px-6 pt-12 pb-8 flex-1"

// Logo mark — large geometric SUI-inspired diamond shape
// 80×80, bg-[--color-primary] rotated 12deg, with inner white diamond
"mb-6"
// aria-hidden="true"

// Headline
"text-3xl font-bold text-[--color-text-primary] leading-tight mb-3"
// → "Loyalty Stamps para sa inyong Tindahan"
// (Line break after "Stamps" on mobile)

// Sub-headline
"text-base text-[--color-text-secondary] leading-relaxed mb-8 max-w-[300px]"
// → "Simple. Libre. Hindi mawawala — nasa blockchain."
```

#### CTA Section

The two CTAs are in the thumb zone. The merchant CTA is primary (higher LTV user).

```
// CTA container — vertical stack, full width
"flex flex-col gap-3 w-full px-6 pb-10"

// Merchant CTA (primary)
<Button className="w-full text-base py-4 bg-[--color-primary] hover:bg-[--color-primary-light] text-white font-bold rounded-[--radius-base]">
  Merchant Ako — Gumawa ng Program
</Button>

// Customer CTA (secondary)
<Button variant="secondary" className="w-full text-base py-4">
  Customer Ako — Tingnan ang Stamps
</Button>
```

#### Value Prop Section

Three simple feature pills between hero and CTAs. Keep it scannable.

```
// Container
"flex flex-col gap-2 px-6 mb-8"

// Each pill
"flex items-center gap-3 rounded-[--radius-base] bg-[--color-bg-surface] border border-[--color-border-subtle] px-4 py-3"

// Icon (inline SVG, 18×18, color --color-accent-loyalty)
// Text
"text-sm text-[--color-text-primary]"

// Three features:
// [star icon]  "Libre — walang monthly fee"
// [lock icon]  "Secure — nasa SUI blockchain"
// [phone icon] "Mobile-friendly — kahit saan"
```

#### Trust Footer

```
// Footer
"border-t border-[--color-border-subtle] py-5 px-6 text-center"

// Text
"text-xs text-[--color-text-muted] leading-relaxed"
// → "Ang inyong mga stamps ay naka-imbak sa SUI blockchain at hindi kontrolado ng sinuman. Ligtas at hindi mawawala."
```

#### States

| State | Behavior |
|---|---|
| Wallet disconnected | Show both CTAs (they route to respective pages where WalletGuard will trigger connect) |
| Wallet connected (merchant returning) | Show "Bumalik sa Dashboard" primary CTA that routes to `/merchant` |
| Wallet connected (customer returning) | Show "Tingnan ang Stamps" primary CTA that routes to `/customer` |

Detecting merchant vs customer role: check if connected wallet has any programs on-chain. If yes, merchant. If no, default to customer view. This check can be async — show the default two CTAs while checking.

#### Accessibility

- `<main>` contains all content.
- `<h1>` is the hero headline.
- The logo mark is `aria-hidden="true"`.
- Both CTA buttons have explicit `aria-label` attributes that clarify destination: `aria-label="I am a merchant — create a stamp program"`.
- The page has `lang="fil"` on the `<html>` element to help screen readers pronounce Filipino text correctly (set this in `layout.tsx`).

---

## Part 6 — Shared Utilities and Patterns

---

### 6.1 Toast Notification System

Used for: stamp success, redeem success, TX errors, network warnings.

#### Placement and Animation

```
// Toast container (rendered in layout, above all content)
"fixed top-4 left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4"

// Individual toast
"w-full max-w-sm pointer-events-auto"
"flex items-start gap-3 rounded-[--radius-base] border px-4 py-3 shadow-xl"
// Animate enter: slide down + fade in (translateY(-100%) opacity-0 → translateY(0) opacity-100, 250ms ease-out)
// Animate exit: slide up + fade out, 200ms ease-in
// Auto-dismiss: 3000ms for success/info, 6000ms for error (needs reading time)
```

#### Toast Variants

```
// Success
"border-[--color-success]/30 bg-[--color-bg-elevated]"
// Icon: check-circle, 18×18, --color-success
// Title: text-sm font-semibold text-[--color-text-primary]
// Body: text-xs text-[--color-text-secondary]

// Error
"border-[--color-error]/30 bg-[--color-bg-elevated]"
// Icon: x-circle, 18×18, --color-error

// Warning
"border-[--color-warning]/30 bg-[--color-bg-elevated]"
// Icon: alert-triangle, 18×18, --color-warning

// Info
"border-[--color-primary]/30 bg-[--color-bg-elevated]"
// Icon: info-circle, 18×18, --color-primary
```

#### ARIA

- Each toast: `role="status"` for success/info; `role="alert"` for error/warning.
- `aria-live="polite"` on the container for success; `aria-live="assertive"` for errors.

---

### 6.2 Page Loading Pattern

All pages that fetch on-chain data should show skeleton content immediately — never a blank screen. Skeletons have been specified per-component. General rules:

- Skeleton duration is not time-limited — it persists until data resolves.
- Use `animate-pulse` (Tailwind built-in) for all skeleton elements.
- Skeleton element colors: `bg-[--color-bg-elevated]` on a `bg-[--color-bg-surface]` card.
- Never show a spinner in place of a whole page — use skeleton cards that match the real content shape.

---

### 6.3 Error Boundary Pattern

```
// Full-page error state
"flex min-h-[100dvh] flex-col items-center justify-center px-5 gap-6"

// Error icon (X in circle, 64×64, --color-error)

// Heading
"text-xl font-semibold text-[--color-text-primary] text-center"
// → "May Problema"

// Body
"text-sm text-[--color-text-secondary] text-center max-w-[280px] leading-relaxed"
// → Dynamic error message or generic: "Nagkaroon ng error. Subukan ulit."

// Retry button
<Button onClick={() => window.location.reload()}>Subukan Ulit</Button>

// Back button (secondary)
<Button variant="ghost" onClick={() => router.back()}>Bumalik</Button>
```

---

### 6.4 Required globals.css Additions

The following `@keyframes` must be added to `/src/app/globals.css` for the animations referenced in this spec:

```css
@keyframes scan {
  0%   { top: 8px; }
  100% { top: calc(100% - 8px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.15); }
  50%       { box-shadow: 0 0 28px rgba(245, 158, 11, 0.35); }
}
```

Reference these in Tailwind with arbitrary animation values:
- Scan line: `style={{ animation: 'scan 2s linear infinite' }}`
- Card glow: `style={{ animation: 'pulse-glow 2.5s ease-in-out infinite' }}`

Until Tailwind v4 supports `@keyframes` registration via config (verify in `node_modules/next/dist/docs/`), use inline `style` prop for these two specific animations.

---

### 6.5 `font-address` Usage

Wallet addresses and transaction IDs must use the `font-address` CSS class from `globals.css` (which applies `--font-mono`, appropriate `font-size`, and `letter-spacing`). Never style addresses with Tailwind's `font-mono` alone — `font-address` also sets the correct size for mid-range Android readability.

---

## Accessibility Summary Checklist

The following requirements apply globally across all Sprint 3 components:

- [ ] Every interactive element reachable and activatable by keyboard (Tab / Enter / Space).
- [ ] All form fields have associated `<label>` elements (the existing `Input` component handles this).
- [ ] Color is never the sole indicator of state — icons or text labels accompany all color-coded states.
- [ ] Touch targets minimum 44×44px on all interactive elements (buttons, links, stepper controls).
- [ ] `aria-live` regions present for all dynamic status updates (toasts, TX progress).
- [ ] Focus returns to the trigger element when modals and bottom sheets close.
- [ ] `lang="fil"` on `<html>` in `layout.tsx` for correct screen reader pronunciation.
- [ ] No information conveyed only by placeholder text — labels are always visible.
- [ ] All images and icon SVGs have either `aria-label` or `aria-hidden="true"`.
- [ ] `prefers-reduced-motion` honored: wrap all `animate-*` classes and CSS animations in a `@media (prefers-reduced-motion: no-preference)` check in globals.css.

---

## Implementation Priority Order

Implement in this order to unblock the stamp flow end-to-end as quickly as possible:

1. `stamp-progress.tsx` — no data dependencies, pure display
2. `stamp-card-display.tsx` — composes StampProgress
3. `qr-code.tsx` — pure display, needed on multiple pages
4. Navigation Header — needed on all pages
5. `/` Landing page — entry point, no wallet required
6. `/merchant` Dashboard — skeleton + empty + populated states
7. `/merchant/create` — form with live preview
8. `/merchant/[programId]` — QR display + stats
9. `qr-scanner.tsx` — camera permissions complexity
10. Scan Customer bottom sheet (Issue 10) — composes scanner
11. `/customer` Collection page
12. `/customer/scan` — composes scanner + stamp card display
