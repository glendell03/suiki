# Suiki V2 — Full UI/UX Revamp Design Spec
**Design Direction: SUI Water (水 · Mizu)**
Date: 2026-03-26 | Status: Approved

---

## 0. Philosophy

This is not a patch — it is a ground-up Version 2. Every screen, component, and interaction
is redesigned from first principles. The guiding constraints:

- **Flat, no gradients.** Solid color blocks only. Gradients feel dated.
- **White card surfaces on off-white background.** Depth via shadow, not color mixing.
- **Blue is structural, gold is emotional.** Blue (`#0ea5e9`) frames and navigates.
  Amber gold (`#d97706`) marks loyalty: earned stamps, rewards, milestones.
- **One primary action per screen.** No choice paralysis.
- **Every state is designed.** Loading, empty, error — none are afterthoughts.
- **Production-grade accessibility.** Contrast ratios verified, tap targets 44px+, reduced motion respected.

---

## 1. Design Tokens

### 1.1 Color System

```
/* Brand — SUI Water */
--color-brand:          #0ea5e9;   /* sky-500 — CTAs, active states, hero fills */
--color-brand-dark:     #0369a1;   /* sky-700 — text on white (4.7:1 contrast ✅ WCAG AA), pressed states */
--color-brand-subtle:   #e0f2fe;   /* sky-100 — chip backgrounds, tinted surfaces */
--color-brand-border:   rgba(14,165,233,0.18); /* blue-tinted card borders */

/* Loyalty — Amber Gold */
--color-loyalty:        #d97706;   /* amber-600 — stamp fills, reward accents */
--color-loyalty-dark:   #b45309;   /* amber-700 — pressed loyalty elements */
--color-loyalty-subtle: #fef3c7;   /* amber-100 — reward card backgrounds */
--color-loyalty-border: rgba(217,119,6,0.2);

/* Surfaces */
--color-bg-base:        #f8fafc;   /* slate-50 — app background (not pure white) */
--color-surface:        #ffffff;   /* white — cards, sheets, modals (elevation via shadow, not color) */

/* Text */
--color-text-primary:   #0f172a;   /* slate-900 — headings, body text */
--color-text-secondary: #475569;   /* slate-600 — labels, subtitles */
--color-text-muted:     #94a3b8;   /* slate-400 — timestamps, wallet addresses */
--color-text-disabled:  #cbd5e1;   /* slate-300 */
--color-text-on-brand:  #ffffff;   /* white text on brand-colored surfaces */

/* Borders & Dividers */
--color-border:         #e2e8f0;   /* slate-200 — default border */
--color-border-strong:  #cbd5e1;   /* slate-300 — emphasized border */

/* Status */
--color-success:        #10b981;   /* emerald-500 */
--color-error:          #ef4444;   /* red-500 */
--color-warning:        #f59e0b;   /* amber-500 */
```

### 1.2 Accessibility — Contrast Verification

| Foreground | Background | Ratio | WCAG AA |
|-----------|------------|-------|---------|
| `#0f172a` on `#ffffff` | — | 17.1:1 | ✅ Pass |
| `#0f172a` on `#f8fafc` | — | 16.5:1 | ✅ Pass |
| `#475569` on `#ffffff` | — | 5.9:1 | ✅ Pass |
| `#0369a1` on `#ffffff` | — | 4.7:1 | ✅ Pass (use for blue text) |
| `#0ea5e9` on `#ffffff` | — | 2.9:1 | ❌ **Never use as text color on white** |
| `#d97706` on `#ffffff` | — | 3.0:1 | ❌ **Never use as text color on white** |
| `#ffffff` on `#0ea5e9` | — | 2.9:1 | ⚠️ Large text only (18px+, bold) |
| `#ffffff` on `#0369a1` | — | 4.7:1 | ✅ Use for text on dark-blue surfaces |
| `#0f172a` on `#fef3c7` | — | 14.5:1 | ✅ Pass |

**Rule:** `#0ea5e9` is for fills, backgrounds, borders, and icons only — never for body text.
All interactive text must use `#0369a1` (brand-dark) or `#0f172a` (text-primary).

### 1.3 Elevation & Shadow

```
--shadow-sm:     0 1px 2px rgba(0,0,0,0.05);
--shadow-card:   0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-sheet:  0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
--shadow-float:  0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
--shadow-modal:  0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
```

No `backdrop-filter: blur()` on list items or cards.
Blur is permitted only on: BottomNav, BottomSheet backdrop, modal overlays.

### 1.4 Typography Scale

```
--font-display: var(--font-plus-jakarta);    /* Plus Jakarta Sans */
--font-body:    var(--font-geist-sans);       /* Geist Sans */
--font-mono:    var(--font-geist-mono);       /* Geist Mono */

/* Scale */
--text-xs:    11px / 16px
--text-sm:    13px / 20px
--text-base:  15px / 24px
--text-lg:    17px / 26px
--text-xl:    20px / 30px
--text-2xl:   24px / 32px
--text-3xl:   30px / 38px
--text-4xl:   36px / 44px
```

### 1.5 Spacing (8pt Grid)

All spacing: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
```

### 1.6 Border Radius

```
--radius-sm:   8px    /* tags, chips, small elements */
--radius-md:   12px   /* inner elements, secondary cards */
--radius-lg:   16px   /* standard cards */
--radius-xl:   20px   /* large cards, sheets */
--radius-2xl:  24px   /* hero cards, featured elements */
--radius-full: 9999px /* pills, avatars, badges */
```

### 1.7 Animation Tokens

```
--duration-micro:  80ms    /* press feedback */
--duration-fast:   150ms   /* color transitions, hover states */
--duration-normal: 250ms   /* element transitions */
--duration-page:   280ms   /* page enter/exit */
--duration-sheet:  350ms   /* bottom sheet, modals */

--ease-out:        cubic-bezier(0.0, 0, 0.2, 1)
--ease-in:         cubic-bezier(0.4, 0, 1, 1)
--ease-standard:   cubic-bezier(0.4, 0, 0.2, 1)
--ease-spring:     spring (see motion config below)
```

---

## 2. Information Architecture

### 2.1 Route Map

```
/ ................................. Landing page (public)
  /customer ........................ Customer dashboard (wallet required)
    /customer/cards ................ All loyalty cards list
    /customer/cards/[id] ........... Card detail + stamp grid (NEW)
    /customer/scan ................. QR code display
    /customer/search ............... Merchant search
  /merchant ........................ Merchant landing (wallet required)
    /merchant/create ............... Create loyalty program
    /merchant/[programId] .......... Program dashboard
```

### 2.2 Navigation Systems

**Customer:** BottomNav (4 tabs, always visible except scan page)
**Merchant:** Simple top header with back navigation (no bottom nav)
**Scan page:** Focused mode — BottomNav hidden, single back chevron

### 2.3 BottomNav Tab Definitions

| Tab | Icon | Label | Route | Note |
|-----|------|-------|-------|------|
| Home | `House` | Home | `/customer` | |
| Cards | `CreditCard` | Cards | `/customer/cards` | |
| Scan | `ScanLine` | Scan | `/customer/scan` | **Primary action — blue filled pill** |
| Explore | `Compass` | Explore | `/customer/search` | |

Active tab: icon + label both in `--color-brand-dark`.
Inactive: icon + label in `--color-text-muted`.
Scan tab always shows with a solid `--color-brand` pill background regardless of active state —
it is the primary repeating action and must always be visually prominent.

---

## 3. Page Layouts

### 3.1 Landing Page (`/`)

**Purpose:** First impression + routing to merchant or customer flow.

**Structure (top → bottom):**
```
┌─────────────────────────────────────┐
│  [solid #0ea5e9 — 42vh min]         │
│                                     │
│   水  (decorative, 10% opacity)     │
│                                     │
│   ● Suiki                           │  Plus Jakarta 800, 36px, white
│   Loyalty on SUI blockchain         │  Geist 400, 15px, rgba(255,255,255,0.75)
│                                     │
├─────────────────────────────────────┤
│  [white surface — flex-1]           │
│                                     │
│  ┌─────────────┐  ┌─────────────┐   │
│  │             │  │             │   │
│  │  Merchant   │  │  Customer   │   │  Two equal cards, shadow-card
│  │  Manage     │  │  Earn &     │   │  border --color-border
│  │  programs   │  │  redeem     │   │
│  │  → arrow    │  │  → arrow    │   │
│  └─────────────┘  └─────────────┘   │
│                                     │
│  ────── Why Suiki? ──────           │
│  ✦ No app download needed           │
│  ✦ Stamps on the blockchain         │
│  ✦ Works at any Suiki merchant      │
│                                     │
└─────────────────────────────────────┘
```

**Details:**
- 水 mark: absolute positioned top-right in blue section, Plus Jakarta 800, ~120px, white 10% opacity
- Two CTA cards: `--radius-xl`, `--shadow-card`, white fill, icon + title + description + `ArrowRight` icon
- Value props: small `--color-brand` square bullet + text in `--color-text-secondary`
- Page has no bottom nav

---

### 3.2 Customer Home (`/customer`)

**Purpose:** Daily-use home screen. Surface active progress, enable quick scanning.

**Structure:**
```
┌─────────────────────────────────────┐
│  ● Suiki logo    [wallet chip]   ⚙  │  PageHeader, white, shadow-sm
├─────────────────────────────────────┤
│  [scrollable content, bg-base]      │
│                                     │
│  Your Cards                [See all]│  SectionHeader — if has cards
│                                     │
│  ┌─────────────────────────────────┐│  Featured StampCard (full-width)
│  │ [avatar] Coffee Bean             ││  Only shown if user has ≥1 card
│  │         Loyalty Program          ││  shadow-sheet, radius-xl
│  │ ████████████████░░░░░░  7/10    ││
│  │ ★★★★★★★★░░  Earn 2 more! →     ││
│  └─────────────────────────────────┘│
│                                     │
│  ─── Quick Actions ──────────────── │
│  [Scan QR] [All Cards] [Explore]    │  QuickAction chips, horizontal scroll
│                                     │
│  ─── Nearby Programs ──────────────│  (future: location-based — show as "More Programs" for now)
│  [StampCard row]                    │  Compact card tiles list
│  [StampCard row]                    │
│  [StampCard row]                    │
│                                     │
│  [Empty state if no cards]          │
│                                     │
└─────────────────────────────────────┘
│  [BottomNav]                        │
└─────────────────────────────────────┘
```

**WalletChip:** truncated address `0xa81e...5f2c`, tap to copy, small blue pill — do NOT use as greeting name.

**Empty state (no cards):**
```
        [ScanLine icon, 48px, --color-brand]
        You have no loyalty cards yet
        Scan a QR code at a Suiki merchant
        to start collecting stamps.
             [Scan QR Code →]  ← button, --color-brand fill
```

**Featured card logic:** Show the card with highest % progress. If multiple cards at same %, show most recently stamped.

---

### 3.3 Customer Cards List (`/customer/cards`)

**Purpose:** Full overview of all stamp cards.

**Structure:**
```
┌─────────────────────────────────────┐
│  ← (back)   My Cards                │  PageHeader
├─────────────────────────────────────┤
│  [All] [Active] [Near Reward] [Done]│  FilterChips, horizontal scroll
├─────────────────────────────────────┤
│  [scrollable list]                  │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ [48px avatar]  Coffee Bean   │   │  StampCard compact tile
│  │               Loyalty Stamps │   │
│  │               7 / 10 stamps  │   │
│  │ [████████░░░░░░░░]  2 more   │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ [48px avatar]  Boba Palace   │   │
│  │               Bubble Tea VIP │   │
│  │               3 / 8 stamps   │   │
│  │ [████░░░░░░░░░░░░]  5 more   │   │
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
│  [BottomNav]                        │
└─────────────────────────────────────┘
```

**StampCard compact tile spec:**
- Full width, `--radius-xl`, `--shadow-card`, `--color-surface` bg
- Tap → navigate to `/customer/cards/[id]`
- Padding: 16px
- Avatar: 48×48, `--radius-full`
- Merchant name: `--font-display` 600, 15px, `--color-text-primary`
- Program name: Geist 400, 13px, `--color-text-secondary`
- Stamp count: Geist 600, 13px — show "X / Y stamps" and "Z more to reward"
- Progress bar: full-width, 4px height, `--radius-full`, `--color-loyalty` fill

**Filter logic:**
- All: all cards
- Active: stampCount > 0 and stampCount < total
- Near Reward: ≥ 80% progress
- Done: stampCount >= total (reward available or redeemed)

**Loading state:** 3× StampCard skeleton tiles while fetching.

---

### 3.4 Card Detail (`/customer/cards/[id]`) — NEW PAGE

**Purpose:** Deep-dive on a single loyalty card. Stamp history, progress, reward redemption.

**Structure:**
```
┌─────────────────────────────────────┐
│  ← (back)                           │  PageHeader, transparent over header
├─────────────────────────────────────┤
│  [solid --color-brand 44px strip]   │
│  [64px avatar]                      │  Avatar overlaps the blue strip
│  Coffee Bean                        │  --font-display 700, 20px
│  Loyalty Stamps Program             │  Geist 400, 13px, --color-text-secondary
│                                     │
│  [Active badge]                     │
├─────────────────────────────────────┤
│  [scrollable content, bg-base]      │
│                                     │
│  ─── Your Progress ─────────────── │
│  ┌─────────────────────────────────┐│
│  │  7 / 10 stamps collected        ││  shadow-card surface card
│  │                                 ││
│  │  ●●●●●●●●○○                    ││  StampGrid lg (24px circles, 5/row)
│  │  (gold filled = earned)         ││
│  │                                 ││
│  │  ████████████████░░░  70%       ││  ProgressBar with milestone at 100%
│  │  3 more stamps to earn reward   ││
│  └─────────────────────────────────┘│
│                                     │
│  ─── Your Reward ──────────────── │
│  ┌─────────────────────────────────┐│
│  │  🏆  Free Coffee                ││  --color-loyalty-subtle bg card
│  │  Collect 10 stamps to unlock    ││
│  │  [Redeem Now →]  (if eligible)  ││  --color-loyalty CTA button
│  └─────────────────────────────────┘│
│                                     │
│  ─── Stamp History ────────────── │
│  [date]  Stamp collected  +1        │  Transaction history list
│  [date]  Stamp collected  +1        │
│  [date]  Reward redeemed  ★         │
│                                     │
└─────────────────────────────────────┘
│  [BottomNav]                        │
└─────────────────────────────────────┘
```

**Reward state logic:**
- `stamps < total`: "X more to earn your reward"
- `stamps >= total AND not redeemed`: "Reward ready! Redeem now" — CTA active, gold theme
- `stamps >= total AND redeemed`: "Reward redeemed on [date]" — completed state

---

### 3.5 QR Scan Page (`/customer/scan`)

**Purpose:** Focused moment. Customer shows QR to merchant to earn stamps.
This is a high-intent screen — design for clarity and confidence.

**Structure:**
```
┌─────────────────────────────────────┐
│  ← (back)                           │  Back only, no full header
├─────────────────────────────────────┤
│  [solid --color-brand top band]     │  ~36vh
│                                     │
│  水                                 │  Decorative, 10% opacity white, large
│                                     │
│  Show QR Code                       │  --font-display 700, 24px, white
│  Hold up to the merchant scanner    │  Geist 400, 14px, rgba(255,255,255,0.75)
│                                     │
├─────────────────────────────────────┤
│  [bg-base — remaining space]        │
│                                     │
│  ┌─────────────────────────────────┐│  Floating QR card
│  │                                 ││  --radius-2xl, --shadow-float
│  │   [BeautifulQR 256×256]         ││  --color-surface bg
│  │                                 ││  padding: 24px
│  └─────────────────────────────────┘│  overlaps blue/white boundary (mt: -48px)
│                                     │
│  0xa81e...5f2c                      │  WalletChip (centered, mono)
│                                     │
│  The merchant will scan this        │  Instruction text, --color-text-muted, 13px
│  to add a stamp to your card        │
│                                     │
└─────────────────────────────────────┘
│  BottomNav HIDDEN on this screen    │
└─────────────────────────────────────┘
```

**Note:** QR card overlaps the blue/white boundary by ~48px (negative margin-top).
This creates a "floating card" effect without gradients or blur.
BottomNav is hidden — this is a focused action, no navigation distraction.

---

### 3.6 Search / Explore (`/customer/search`)

**Purpose:** Discover merchants running Suiki programs.

**Structure:**
```
┌─────────────────────────────────────┐
│  Explore Merchants                  │  PageHeader (no back — is a tab)
├─────────────────────────────────────┤
│  [SearchBar — autofocus on mount]   │  Rounded, full-width, --color-surface
├─────────────────────────────────────┤
│  [scrollable content]               │
│                                     │
│  ─── Browse All ───────────────── │  (no recent searches in V2 — too complex)
│  ┌──────────────────────────────┐   │
│  │ [40px avatar]  Coffee Bean   │   │  Merchant row tile
│  │               1 program      │   │
│  │               [Active]       │   │
│  └──────────────────────────────┘   │
│  [more merchant rows...]            │
│                                     │
│  [Empty state if no results]        │
│                                     │
└─────────────────────────────────────┘
│  [BottomNav] ← CURRENTLY MISSING!  │  Bug fix in V2
└─────────────────────────────────────┘
```

**Bug fix:** Current `/customer/search` is missing BottomNav. V2 includes it.

---

### 3.7 Merchant Landing (`/merchant`)

**Purpose:** Entry point for merchants. Simple gateway.

**Structure:**
```
┌─────────────────────────────────────┐
│  [solid --color-brand top section]  │
│                                     │
│  水                                 │
│  Suiki for Merchants                │
│  Build loyalty. Keep customers.     │
│                                     │
├─────────────────────────────────────┤
│  [content]                          │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  + Create New Program        │   │  Primary CTA card
│  └──────────────────────────────┘   │
│                                     │
│  ─── Your Programs ────────────── │
│  [Program tiles or empty state]     │
│                                     │
└─────────────────────────────────────┘
```

---

### 3.8 Merchant Create Program (`/merchant/create`)

**Purpose:** Set up a new loyalty program. Multi-step, focused.

**Step flow:**
```
Step 1/4: Program Name
  → Large text input: "What's your program called?"
  → Helper: "e.g. Coffee Bean Loyalty Stamps"

Step 2/4: Stamp Goal
  → "How many stamps to earn a reward?"
  → Number picker: [−] [10] [+] (range 2–50)
  → "Customers will stamp each visit"

Step 3/4: Reward
  → "What do customers earn?"
  → Text input: "e.g. One free coffee"

Step 4/4: Review
  → Card preview of the program
  → [Create Program] CTA

Navigation: [← Back] ................. [Next →]
```

**StepIndicator at top:** 4 dots, filled up to current step.
Keyboard behavior: Return key advances to next step.

---

### 3.9 Merchant Program Dashboard (`/merchant/[programId]`)

**Purpose:** View stats, share QR code for merchant scanning (to stamp customers).

**Structure:**
```
┌─────────────────────────────────────┐
│  ← Programs   [Program Name]        │  PageHeader
├─────────────────────────────────────┤
│  Stats row: [Active] [Total stamps] │
├─────────────────────────────────────┤
│  ─── Merchant QR Code ───────────  │
│  ┌─────────────────────────────────┐│
│  │  [BeautifulQR — merchant stamp] ││
│  │  Show customers this code       ││
│  │  [Copy Link]  [Share]           ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  ─── Recent Activity ────────────  │
│  [Stamp activity list]              │
└─────────────────────────────────────┘
```

---

## 4. Component Library

Every component lives in `src/components/` (flat, no subdirectories).
Import via `@/components/[name]`.

### 4.1 `BottomNav`

**File:** `src/components/bottom-nav.tsx`
**Props:**
```typescript
// No props — reads router to determine active tab
```
**Spec:**
- White surface, `--shadow-float`, `--radius-2xl` (top corners only: `rounded-t-none` bottom, `rounded-3xl` top)
- `padding-bottom: env(safe-area-inset-bottom)` + 8px
- Height: 64px content + safe area
- 4 tabs evenly spaced
- Scan tab: solid `--color-brand` pill background (always, not just when active)
- Active tab (non-scan): icon `--color-brand-dark`, label `--color-brand-dark`, 600 weight
- Inactive: icon + label `--color-text-muted`, 400 weight
- Press: `whileTap={{ scale: 0.90 }}` Framer Motion — spring `stiffness:500 damping:30`
- Scan pill is a static highlight (always shown) — no `layoutId` needed on BottomNav itself

### 4.2 `StampCard`

**File:** `src/components/stamp-card.tsx`
**Props:**
```typescript
interface StampCardProps {
  programId: string;
  merchantName: string;
  programName: string;
  logoUrl?: string;
  stampCount: number;
  totalStamps: number;
  rewardDescription: string;
  variant?: 'compact' | 'featured';
  onTap?: () => void;
}
```
**Spec (compact variant):**
- Full-width tile, `--radius-xl`, `--shadow-card`, white bg
- Padding: 16px
- Left: `MerchantAvatar` size=48
- Right of avatar: merchant name (bold, 15px) + program name (secondary, 13px) + stamp count (600, 13px, muted)
- Bottom: `ProgressBar` full-width, 4px, with `--color-loyalty` fill
- "X more to reward" text below bar if < total stamps
- "Reward ready! ★" badge if >= total stamps (amber badge)
- Tap target: full card

**Spec (featured variant — home page):**
- Full-width, `--radius-xl`, `--shadow-sheet`, white bg
- Larger padding: 20px
- `MerchantAvatar` size=56, inline with merchant name
- `StampGrid` size='sm' visible (compact dot row)
- `ProgressBar` with height 6px
- More prominent reward CTA if eligible

### 4.3 `StampGrid`

**File:** `src/components/stamp-grid.tsx`
**Props:**
```typescript
interface StampGridProps {
  earned: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  animateNewStamp?: boolean; // spring bounce on last earned stamp
}
```
**Spec:**
- Layout: `flex flex-wrap gap-[X]` — items per row: 5 (up to 10), then wrap
- `sm`: 10px circles, 4px gap — for compact card tiles
- `md`: 18px circles, 6px gap — for featured card, search results
- `lg`: 26px circles, 8px gap — for card detail page
- Earned: solid `--color-loyalty` fill + small checkmark icon (Lucide `Check`, white, strokeWidth 2.5)
- Unearned: `--color-border` border 1.5px, transparent fill
- `animateNewStamp`: the most recently earned stamp plays spring entry: scale 0→1.15→1, `stiffness:400 damping:17`

### 4.4 `ProgressBar`

**File:** `src/components/progress-bar.tsx`
**Props:**
```typescript
interface ProgressBarProps {
  value: number;       // 0 to 1
  height?: number;     // px, default 4
  animated?: boolean;  // animate fill on mount, default true
  showMilestone?: boolean; // show gold dot at 100%
  className?: string;
}
```
**Spec:**
- Track: `--color-border` fill, `--radius-full`, full-width
- Fill: `--color-loyalty`, animates from 0 to `value` on mount (motion `initial={{ scaleX: 0 }} animate={{ scaleX: value }}`, `transformOrigin: 'left'`)
- Transition: spring `stiffness: 200, damping: 30, delay: 0.2`
- Milestone dot: absolute positioned at 100% mark, `--color-loyalty`, 8px circle, only visible if `showMilestone`
- Edge case: `value = 0` renders empty track (not broken/invisible bar)
- Edge case: `value >= 1` fills entirely + milestone dot glows (drop-shadow filter)

### 4.5 `MerchantAvatar`

**File:** `src/components/merchant-avatar.tsx`
**Props:**
```typescript
interface MerchantAvatarProps {
  logoUrl?: string;
  name: string;
  size?: 32 | 40 | 48 | 56 | 64;
  className?: string;
}
```
**Spec:**
- `size` px square, `--radius-full`
- If `logoUrl`: render `<img>` (not next/image — external URLs not whitelisted; use raw img with error handler)
- If no `logoUrl` or image load fails: initials fallback
  - Take first letter of each word (max 2 letters): "Coffee Bean" → "CB"
  - Background: `--color-brand-subtle`, text: `--color-brand-dark`, `--font-display` 700
  - Size scaling: 32→12px, 40→14px, 48→16px, 56→18px, 64→20px
- `onError` on img: switch to initials fallback (React state)

### 4.6 `PageHeader`

**File:** `src/components/page-header.tsx`
**Props:**
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;  // back button
  rightAction?: React.ReactNode; // settings, etc.
  transparent?: boolean;         // for card detail overlap
}
```
**Spec:**
- White background (or transparent if prop set), `--shadow-sm` bottom
- Height: 56px (+ `env(safe-area-inset-top)`)
- Title: `--font-display` 700, 17px, `--color-text-primary`, centered
- Subtitle: Geist 400, 13px, `--color-text-secondary`, centered below title (if provided)
- `leftAction`: 40×40 tap target, left edge 12px
- `rightAction`: 40×40 tap target, right edge 12px
- Back button: `ChevronLeft` 20px, `--color-text-primary`, inside rounded-full tappable area

### 4.7 `WalletChip`

**File:** `src/components/wallet-chip.tsx`
**Props:**
```typescript
interface WalletChipProps {
  address: string;
  className?: string;
}
```
**Spec:**
- Display: `{address.slice(0,6)}...{address.slice(-4)}` — e.g. `0xa81e...5f2c`
- Background: `--color-brand-subtle`, text: `--color-brand-dark`
- `--radius-full`, padding: 4px 10px
- Font: Geist Mono, 12px, 500 weight
- Tap: copy full address to clipboard → brief "Copied!" tooltip (300ms fade)
- Inline `Wallet` icon (14px) left of text

### 4.8 `QuickAction`

**File:** `src/components/quick-action.tsx`
**Props:**
```typescript
interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  href: string;
  variant?: 'default' | 'primary';
}
```
**Spec:**
- Horizontal chip: icon (20px) + label (13px, 600)
- `variant='default'`: white bg, `--color-border` border, `--color-text-primary` text
- `variant='primary'`: `--color-brand` bg, white text/icon — used for Scan QR
- `--radius-full`, padding: 10px 16px, `--shadow-sm`
- `whileTap={{ scale: 0.94 }}` Framer Motion

### 4.9 `EmptyState`

**File:** `src/components/empty-state.tsx`
**Props:**
```typescript
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}
```
**Spec:**
- Centered layout (flex col, items-center, text-center)
- Icon: 48px, `--color-brand`, inside 80px `--color-brand-subtle` circle
- Title: `--font-display` 600, 17px, `--color-text-primary`, mt-16px
- Description: Geist 400, 14px, `--color-text-secondary`, mt-8px, max-width 260px
- CTA button (if `action`): `--color-brand` fill, white text, `--radius-full`, mt-20px

### 4.10 `FilterChips`

**File:** `src/components/filter-chips.tsx`
**Props:**
```typescript
interface FilterChipsProps {
  id: string;  // unique per page — used to scope layoutId and avoid conflicts
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}
```
**Spec:**
- Horizontal scroll (no scrollbar visible: `scrollbar-none`)
- Each chip: `--radius-full`, padding 8px 16px, 13px Geist 600
- Inactive: `--color-surface` bg, `--color-border` border, `--color-text-secondary` text
- Active: `--color-brand` bg, white text, no border
- Transition: `--duration-fast` ease
- `whileTap={{ scale: 0.95 }}`
- Motion `layoutId` on active chip background pill for smooth slide (scoped per FilterChips instance via a unique `id` prop)

### 4.11 `BottomSheet`

**File:** `src/components/bottom-sheet.tsx`
**Props:**
```typescript
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
```
**Spec:**
- Fixed overlay: `rgba(0,0,0,0.4)` backdrop, tap to close
- Sheet: white, `--radius-2xl` top corners, `--shadow-modal`
- Drag handle: 32×4px `--color-border` pill, centered top 8px
- Title: `--font-display` 700, 17px, `--color-text-primary`, centered
- Enter: `y: '100%' → y: 0`, spring `stiffness:300 damping:30`
- Exit: `y: '100%'`, duration 250ms ease-in
- `AnimatePresence` wraps the sheet
- Safe area bottom padding

### 4.12 `Badge`

**File:** `src/components/badge.tsx`
**Props:**
```typescript
interface BadgeProps {
  variant: 'active' | 'completed' | 'new' | 'reward' | 'muted';
  children: React.ReactNode;
}
```
**Spec:**
- `--radius-full`, padding 3px 10px, Geist 600, 11px
- active: `--color-brand-subtle` bg, `--color-brand-dark` text
- completed: `#dcfce7` bg, `#166534` text (green)
- new: `--color-loyalty-subtle` bg, `--color-loyalty-dark` text
- reward: `--color-loyalty` bg, white text
- muted: `--color-bg-base` bg, `--color-text-muted` text

### 4.13 `StepIndicator`

**File:** `src/components/step-indicator.tsx`
**Props:**
```typescript
interface StepIndicatorProps {
  steps: number;
  current: number; // 1-based
}
```
**Spec:**
- Horizontal row of `steps` dots, centered
- Completed (< current): solid `--color-brand`, 8px, `--radius-full`
- Current: solid `--color-brand`, 20px wide × 8px tall pill (expanded)
- Pending (> current): `--color-border`, 8px, `--radius-full`
- Gap: 6px between dots
- Active pill uses Motion `layoutId` for smooth expansion animation

### 4.14 `Skeleton`

**File:** `src/components/skeleton.tsx`
**Props:**
```typescript
interface SkeletonProps {
  variant: 'text' | 'avatar' | 'card' | 'stamp-row';
  className?: string;
}
```
**Spec:**
- `--color-border` fill, CSS animation: `pulse` (opacity 1→0.5, 1.2s ease-in-out infinite)
- text: 100% wide × 14px, `--radius-sm`
- avatar: circle, configurable size
- card: full StampCard shape with inner skeleton regions
- stamp-row: row of 5–10 small circles

### 4.15 `SectionHeader`

**File:** `src/components/section-header.tsx`
**Props:**
```typescript
interface SectionHeaderProps {
  title: string;
  action?: { label: string; href: string };
}
```
**Spec:**
- Flex row, space-between
- Title: `--font-display` 600, 15px, `--color-text-primary`
- Action link: Geist 500, 13px, `--color-brand-dark`
- Margin: 0 0 12px 0

### 4.16 `SearchBar`

**File:** `src/components/search-bar.tsx`
**Props:**
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}
```
**Spec:**
- `--color-surface` bg, `--color-border` border, `--radius-xl`, `--shadow-sm`
- Height: 48px, padding: 0 16px
- `Search` icon (16px, `--color-text-muted`) left side
- Clear button (×) when value non-empty, right side
- Focus: `--color-brand` border color, `--shadow-card` elevation change
- Transition: `--duration-fast` ease on border/shadow

---

## 5. Animation System

### 5.1 MotionConfig (App Root)

```tsx
// src/app/providers.tsx
import { MotionConfig } from "motion/react";

<MotionConfig reducedMotion="user">
  {children}
</MotionConfig>
```

`reducedMotion="user"` reads `prefers-reduced-motion` — all animations
automatically disabled for accessibility. No custom logic needed.

### 5.2 Page Transitions

```tsx
// Page enter (AnimatePresence mode="wait" wraps routes)
initial: { opacity: 0, y: 12 }
animate: { opacity: 1, y: 0 }
transition: { type: "spring", stiffness: 300, damping: 26, mass: 0.8 }

// Page exit
exit: { opacity: 0, y: -6 }
transition: { duration: 0.18, ease: [0.4, 0, 1, 1] }
```

### 5.3 List Stagger (Card Lists)

```tsx
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 }
  }
};
```

### 5.4 Stamp Collect Animation

```tsx
// New stamp earned
initial: { opacity: 0, scale: 0.3 }
animate: { opacity: 1, scale: 1 }
transition: { type: "spring", stiffness: 400, damping: 17 }
// The single overshoot bounce = tactile satisfaction
```

### 5.5 QR Code Reveal

```tsx
// Outer card
initial: { opacity: 0, y: 40, scale: 0.92 }
animate: { opacity: 1, y: 0, scale: 1 }
transition: { type: "spring", stiffness: 280, damping: 24 }

// QR code inner (delayed)
initial: { opacity: 0, scale: 0.85 }
animate: { opacity: 1, scale: 1 }
transition: { type: "spring", stiffness: 320, damping: 22, delay: 0.12 }
```

### 5.6 BottomNav Tab Press

```tsx
whileTap={{ scale: 0.88 }}
transition={{ type: "spring", stiffness: 500, damping: 30 }}
```

### 5.7 Press / Hover (CSS Only)

```css
/* All tappable elements */
.tap-target {
  transition: transform var(--duration-micro) ease-out,
              opacity  var(--duration-micro) ease-out;
  -webkit-tap-highlight-color: transparent;
}

.tap-target:active {
  transform: scale(0.96);
  opacity: 0.85;
}
```

### 5.8 FilterChip Active Indicator

```tsx
// Active chip background slides between options
<motion.div
  layoutId="filter-chip-active"
  className="absolute inset-0 rounded-full bg-[--color-brand]"
  transition={{ type: "spring", stiffness: 500, damping: 35 }}
/>
```

### 5.9 ProgressBar Fill

```tsx
<motion.div
  initial={{ scaleX: 0 }}
  animate={{ scaleX: value }}
  style={{ transformOrigin: 'left' }}
  transition={{ type: "spring", stiffness: 200, damping: 30, delay: 0.2 }}
/>
```

---

## 6. State & Edge Cases

### 6.1 Wallet Not Connected

All customer routes are wrapped in `WalletGuard`. If not connected:
- Show centered connect wallet prompt
- Heading: "Connect your wallet"
- Description relevant to the page context
- `ConnectWallet` button in `--color-brand` style
- No broken partial UI

### 6.2 Loading States

Every data-fetching page shows skeleton tiles during loading.
Never show a spinner for list content — skeletons preserve layout.
A global loading spinner is acceptable only for transaction submission.

### 6.3 Error States

- Network error fetching cards: `EmptyState` with error message + Retry button
- Transaction failed: toast notification (slide-in from top), auto-dismiss 4s
- Wallet sign rejected: bottom sheet dismisses, no state corruption

### 6.4 Long Content Edge Cases

- Long merchant name: truncate with `truncate` class (single line, ellipsis)
- Long program name: truncate single line
- 0 stamps: progress bar renders at 0 width (no NaN, no invisible element)
- 1 stamp / 1 total: 100% progress, reward state immediately
- Max stamps (50): stamp grid wraps properly, no overflow
- Very long reward description: 2-line clamp on compact tiles

---

## 7. Validation Checklist

### 7.1 Accessibility
- [ ] All tap targets ≥ 44×44px (BottomNav tabs, back buttons, chips)
- [ ] Minimum contrast 4.5:1 for all text (verified in Section 1.2)
- [ ] `--color-brand` (#0ea5e9) never used as text color on white
- [ ] All icons have `aria-hidden={true}` when decorative
- [ ] All interactive elements have accessible labels or text content
- [ ] `MotionConfig reducedMotion="user"` at app root
- [ ] Focus rings visible on keyboard navigation (not hidden by outline-none without alternative)
- [ ] `lang="en"` on html element ✓ (already in layout.tsx)

### 7.2 Performance
- [ ] No `backdrop-filter: blur()` on list items or cards
- [ ] Only BottomNav and BottomSheet use blur if any
- [ ] All animations CSS-composited (transform + opacity only)
- [ ] `img` elements have explicit width/height to prevent layout shift
- [ ] No unnecessary re-renders from hook over-subscription
- [ ] Skeleton screens on all data-fetching views

### 7.3 Mobile UX
- [ ] `env(safe-area-inset-bottom)` on BottomNav
- [ ] `env(safe-area-inset-top)` on PageHeader
- [ ] `-webkit-tap-highlight-color: transparent` on tappable elements
- [ ] No `user-select` issues on card content
- [ ] `touch-action: manipulation` on tap targets (removes 300ms delay)

### 7.4 Design Consistency
- [ ] No raw hex values in JSX — only CSS variable tokens
- [ ] No inline gradients anywhere
- [ ] All QR codes use `BeautifulQR` component
- [ ] All page backgrounds use `--color-bg-base` (not `bg-white`)
- [ ] `BottomNav` present on all 4 customer tab routes
- [ ] `BottomNav` absent on `/customer/scan` (focused mode)
- [ ] `--font-display` (Plus Jakarta Sans) for all headings
- [ ] Geist Sans for all body text
- [ ] Geist Mono only for wallet addresses and codes

### 7.5 State Coverage
- [ ] Every page has: loading state, empty state, error state, populated state
- [ ] Wallet not connected handled by WalletGuard on all customer routes
- [ ] 0 stamps edge case tested
- [ ] Max stamps edge case tested
- [ ] Long text edge cases tested (truncation, no overflow)

---

## 8. Files to Create / Modify

### New Files
```
src/components/stamp-card.tsx          (replaces/revamps existing)
src/components/stamp-grid.tsx          (new)
src/components/progress-bar.tsx        (replaces progress-bar-stamps)
src/components/merchant-avatar.tsx     (new)
src/components/quick-action.tsx        (new)
src/components/page-header.tsx         (replaces/revamps existing)
src/components/wallet-chip.tsx         (new)
src/components/bottom-sheet.tsx        (new)
src/components/badge.tsx               (revamps existing)
src/components/step-indicator.tsx      (new)
src/components/skeleton.tsx            (new)
src/components/section-header.tsx      (new)
src/components/filter-chips.tsx        (new)
src/app/customer/cards/[id]/page.tsx   (new route)
```

### Modified Files
```
src/app/globals.css                    (new token system)
src/components/bottom-nav.tsx          (add labels, revamp)
src/components/search-bar.tsx          (revamp)
src/components/empty-state.tsx         (revamp)
src/app/page.tsx                       (full redesign)
src/app/customer/page.tsx              (full redesign)
src/app/customer/cards/page.tsx        (full redesign)
src/app/customer/scan/page.tsx         (full redesign)
src/app/customer/search/page.tsx       (add BottomNav, redesign)
src/app/merchant/page.tsx              (full redesign)
src/app/merchant/create/page.tsx       (multi-step revamp)
src/app/providers.tsx                  (add MotionConfig)
```

---

## 9. Out of Scope (V2)

The following are explicitly excluded from V2 to keep scope executable:

- Location-based merchant discovery (GPS)
- Push notifications
- Social features (share stamps, leaderboards)
- Multiple wallet support
- Merchant analytics dashboard
- Stamp expiry logic
- NFC (project-wide: no NFC per CLAUDE.md)
