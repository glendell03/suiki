---
title: "Suiki — UX Design: User Flows & Component Spec"
date: 2026-03-25
status: draft
tags:
  - project/suiki
  - type/ux-design
  - stage/design
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — UX Design: User Flows & Component Spec

> Design brief for the frontend developer. This document is the single source of truth for screen states, component behavior, and mobile UX decisions. Implement directly from this spec.

---

## Table of Contents

1. [User Personas](#1-user-personas)
2. [Design Principles](#2-design-principles)
3. [Critical UX Flows](#3-critical-ux-flows)
4. [Component Specifications](#4-component-specifications)
5. [Mobile-First Design Decisions](#5-mobile-first-design-decisions)
6. [Filipino MSME UX Considerations](#6-filipino-msme-ux-considerations)
7. [Color & Typography System](#7-color--typography-system)
8. [Error State Catalog](#8-error-state-catalog)

---

## 1. User Personas

### Maria — The Merchant

| Attribute | Detail |
|-----------|--------|
| Age | 45 |
| Location | Quezon City, Metro Manila |
| Business | Sari-sari store, 6am–10pm daily |
| Device | Android mid-range (Samsung A-series), screen 6.5" |
| Tech comfort | Uses GCash daily, has Facebook, can send files via Messenger |
| Blockchain knowledge | Zero — "block ano?" |
| Pain point | Repeat customers go to SM because SM has loyalty points |
| Goal | Keep customers coming back without buying expensive POS software |
| Key fear | "Mahirap ba ito? Magastos ba?" (Is this hard? Is it expensive?) |
| Session context | Behind a store counter, one hand free, ambient noise |

**Design implications for Maria:**
- Every action must complete in under 3 taps
- No jargon: "stamp" not "NFT mint", "reward" not "redemption"
- Confirmation screens must be unambiguous — she cannot afford mistakes
- The QR scan flow must work with one hand while serving a customer

---

### Juan — The Customer

| Attribute | Detail |
|-----------|--------|
| Age | 24 |
| Location | QC — commutes to Katipunan for school |
| Device | Xiaomi or iPhone 13 (gaming use) |
| Tech comfort | Has Slush wallet for SUI gaming tokens, uses crypto casually |
| Blockchain knowledge | Moderate — understands wallets, not smart contracts |
| Goal | Collect free stuff from stores he already goes to |
| Key behavior | Checks cards when waiting in line or riding MRT |
| Session context | Quick interactions, often standing or commuting |

**Design implications for Juan:**
- His wallet is already connected — skip the education
- Make the stamp count satisfying to look at (progress = dopamine)
- The "show this QR" flow must be instant — no loading before he can show the merchant
- Celebration moments on first stamp and on full card matter to him

---

## 2. Design Principles

These five principles must be applied to every screen decision.

**P1 — Counter over Cash.** Never show SUI token amounts, gas fees, or blockchain addresses to customers unless absolutely necessary. Maria does not know what a gas fee is. Juan does not care.

**P2 — Instant Confidence.** Every action must have a visible response within 100ms (button state change, spinner, or partial UI update) even if the blockchain tx takes 600ms. Silence = broken.

**P3 — Filipino Context-First.** Default to Filipino informal register for key CTAs. "I-scan" beats "Scan". "Ipadala ang stamp" beats "Issue stamp transaction". English is fine for labels and titles but CTAs must feel local.

**P4 — Thumb-Zone Everything.** All primary CTAs live in the bottom 40% of the viewport. Top navigation is for identity (logo, wallet status) only. Maria's thumb does not reach the top of a 6.5" screen while behind a counter.

**P5 — Trust Through Simplicity.** Every screen that touches blockchain must show progress feedback. "Loading" alone is not enough — show what is happening: "Confirming stamp on SUI...". This converts skeptical users.

---

## 3. Critical UX Flows

### Flow 1: Merchant Onboarding

**Entry point:** Landing page → "I'm a Merchant" button

**Goal:** Maria creates her first stamp program and gets a QR code she can show customers.

**Expected duration:** Under 2 minutes for a first-time user.

---

#### Screen 1.1 — Landing Page (wallet disconnected)

```
┌─────────────────────────────────┐
│  [Suiki logo — top left]        │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Suiki                    │  │
│  │  Loyalty stamps para sa   │  │
│  │  inyong tindahan          │  │
│  └───────────────────────────┘  │
│                                 │
│  [Connect Slush Wallet] ←─────── primary CTA, blue, full-width
│                                 │
│  ──────── or ────────           │
│                                 │
│  [I'm a Merchant]  ←─────────── secondary, outlined
│  [I'm a Customer]  ←─────────── secondary, outlined
│                                 │
│  ─────────────────────────────  │
│  Ang inyong mga stamps ay nasa  │
│  SUI blockchain — safe at hindi │
│  mawawala.                      │
│  (small, gray trust message)    │
└─────────────────────────────────┘
```

**Notes:**
- "I'm a Merchant" and "I'm a Customer" buttons work even without wallet connection — they route to the role and show a connect prompt inline
- Trust message is in Filipino to speak directly to skeptical users
- No blockchain jargon in the hero copy

---

#### Screen 1.2 — Wallet Connection Modal

Triggered when: user taps "Connect Slush Wallet" or tries to access /merchant without a wallet.

```
┌─────────────────────────────────┐
│  [Connecting... / Choose wallet]│
│                                 │
│  ┌──────────────────────────┐   │
│  │  [Slush icon]  Slush     │   │  ← primary option, prominent
│  └──────────────────────────┘   │
│                                 │
│  Wala pa ang Slush wallet?      │
│  [I-download ang Slush] ──────── opens slush.org in new tab
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘
```

**States:**
- Default: Show wallet options (only Slush for MVP)
- Connecting: Show spinner inside Slush row, "Nagkokonekta..."
- Connected: Modal dismisses, wallet address appears in top-right nav
- Error: "Hindi nakakonekta. Subukan ulit." with retry button

**No wallet installed flow:**
If Slush is not detected, show: "Kailangan ang Slush Wallet. I-download muna sa slush.org." with a download link. Do not show an empty list or a JS error.

---

#### Screen 1.3 — Merchant Dashboard (first visit, empty)

Route: `/merchant`

```
┌─────────────────────────────────┐
│  [← Suiki]          [0x1a2b...] │  ← wallet address, truncated
│                                 │
│  Aking mga Program              │
│                                 │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │                           │  │
│  │  Walang programa pa.      │  │
│  │                           │  │
│  │  Gumawa ng unang loyalty  │  │
│  │  stamp program para sa    │  │
│  │  inyong tindahan.         │  │
│  │                           │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  + Gumawa ng Program      │  │  ← primary CTA, blue, full-width bottom
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

#### Screen 1.4 — Create Program Form

Route: `/merchant/create`

```
┌─────────────────────────────────┐
│  [← Bumalik]                    │
│                                 │
│  Bagong Stamp Program           │
│  ────────────────────────────   │
│                                 │
│  Pangalan ng Tindahan *         │
│  ┌──────────────────────────┐   │
│  │  hal. Kape ni Juan       │   │
│  └──────────────────────────┘   │
│                                 │
│  Logo URL  (opsyonal)           │
│  ┌──────────────────────────┐   │
│  │  https://...             │   │
│  └──────────────────────────┘   │
│  Maaaring Facebook photo link   │  ← helper text below field
│                                 │
│  Ilang stamps bago ma-reward? * │
│  ┌──────────────────────────┐   │
│  │  10                 [+][-]│   │  ← number stepper, not free-type
│  └──────────────────────────┘   │
│  Mula 1 hanggang 100 stamps     │
│                                 │
│  Ano ang reward? *              │
│  ┌──────────────────────────┐   │
│  │  hal. Libreng kape       │   │
│  └──────────────────────────┘   │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                 │
│  [Gumawa ng Program] ←────────── primary CTA, sticky bottom, blue
└─────────────────────────────────┘
```

**Validation rules:**
| Field | Rule | Error message |
|-------|------|---------------|
| Pangalan ng Tindahan | Required, 1–60 chars | "Kailangan ang pangalan ng tindahan." |
| Logo URL | Optional, but if filled must be a valid URL | "Di-valid ang URL. Tiyaking nagsisimula sa https://" |
| Stamps required | Required, integer 1–100 | "Pumili ng 1 hanggang 100." |
| Reward description | Required, 1–100 chars | "Ilarawan ang reward para sa inyong customers." |

**Validation timing:** Validate on blur (when user leaves a field), not on every keystroke. Show errors inline below the field in red. Do not show all errors at once on first load.

**Loading state (after submit):**

The "Gumawa ng Program" button transforms to:
```
┌────────────────────────────────┐
│  [spinner]  Nagde-deploy...    │
└────────────────────────────────┘
```
Subtext below button: "Kinokonekta sa SUI blockchain. ~5 segundo."

Button is disabled during loading. User cannot double-submit.

---

#### Screen 1.5 — Program Created Success

Shown after successful `create_program` transaction. Route stays at `/merchant/create` momentarily before auto-redirect or inline success state.

```
┌─────────────────────────────────┐
│                                 │
│          ✓                      │  ← large green checkmark, animated
│                                 │
│  Tagumpay!                      │
│  (Success!)                     │
│                                 │
│  Nagawa na ang inyong           │
│  Stamp Program.                 │
│                                 │
│  [Tingnan ang QR Code] ──────── primary CTA → /merchant/{id}
│                                 │
└─────────────────────────────────┘
```

Auto-redirect to `/merchant/{programId}` after 2 seconds if user does not tap.

---

#### Screen 1.6 — Merchant QR Page

Route: `/merchant/{programId}` — default "My QR Code" tab

```
┌─────────────────────────────────┐
│  [← Bumalik]                   │
│                                 │
│  [logo img 48px]  Kape ni Juan  │
│                   10 stamps → Libreng kape
│                                 │
│  ┌──── My QR Code ─── Scan Customer ──┐
│  │   (active tab)     (inactive)       │
│  └───────────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │  [QR code — 256x256px]      ││
│  │  ┌───────────────────────┐  ││
│  │  │ ▓▓▓▓▓▓▓ ▓ ▓▓▓▓▓▓▓   │  ││
│  │  │ ▓     ▓   ▓     ▓   │  ││
│  │  │ [S]   center logo   │  ││  ← Suiki "S" watermark center
│  │  └───────────────────────┘  ││
│  └─────────────────────────────┘│
│                                 │
│  I-scan ng customer ang QR      │
│  para makita ang inyong programa│
│                                 │
│  [I-share ang Link] ←────────── share PWA link via native share sheet
│                                 │
│  Stamps na in-issue: 0          │
└─────────────────────────────────┘
```

---

### Flow 2: Customer First Stamp (New Card)

**Entry point:** Customer is at Maria's store. Maria is on Screen 1.6 "Scan Customer" tab. Juan opens `/customer` on his phone.

**Goal:** Juan earns his first stamp. A new StampCard is created for him.

**This flow handles the case where Juan does not yet have a card for this program.**

---

#### Screen 2.1 — Customer Page (wallet connected)

Route: `/customer`

```
┌─────────────────────────────────┐
│  [← Suiki]          [0xBEEF...]│
│                                 │
│  Aking mga Stamp Cards          │
│                                 │
│  ┌─────────────────────────────┐│
│  │  [QR code — 180x180]        ││  ← customer QR code, always visible
│  │                             ││
│  │  Ipakita ito sa merchant    ││
│  │  para kumita ng stamp       ││
│  └─────────────────────────────┘│
│                                 │
│  ──── Aking mga Cards ────      │
│                                 │
│  Wala pa.                       │
│  Pumunta sa isang Suiki merchant│
│  at i-scan ang kanilang QR code.│
│                                 │
│  [I-scan ang Merchant QR] ────── secondary CTA → /customer/scan
└─────────────────────────────────┘
```

**The customer QR code is always visible at the top, above the card list.** This is the primary action surface for Juan — he holds up this screen and Maria scans it.

---

#### Screen 2.2 — Merchant: Scan Customer Tab

Route: `/merchant/{programId}` — "Scan Customer" tab

```
┌─────────────────────────────────┐
│  ┌── My QR Code ──│ Scan Customer ─┐
│  │  (inactive)    │  (active tab)   │
│  └───────────────────────────────┘│
│                                    │
│  ┌─────────────────────────────┐   │
│  │  [camera viewfinder]        │   │
│  │                             │   │
│  │   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │   │  ← scan box, animated corners
│  │   │                   │   │   │
│  │   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │   │
│  └─────────────────────────────┘   │
│                                    │
│  I-scan ang QR code ng customer    │
│                                    │
│  [I-stop ang Camera] ←──────────── shows only when camera is active
└────────────────────────────────────┘
```

**Camera permission prompt (first time only):**
Native browser permission dialog appears. Below the viewfinder, show: "Kailangan ang camera para ma-scan ang QR. Payagan ang access sa itaas."

---

#### Screen 2.3 — Stamping in Progress

Triggered immediately after merchant scans customer QR. Replace the scanner view with:

```
┌─────────────────────────────────┐
│  ┌─────────────────────────────┐│
│  │                             ││
│  │     [circular spinner]      ││
│  │                             ││
│  │  Nagbibigay ng stamp...     ││
│  │                             ││
│  │  Kinokonekta sa SUI...      ││  ← secondary text, smaller
│  │                             ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Duration:** Typically 600ms–1200ms with sponsored gas.

Do not show the wallet address or transaction hash at this stage. Maria does not need that information.

---

#### Screen 2.4 — First Stamp Success (New Card Created)

Triggered after successful `create_card_and_stamp` transaction.

```
┌─────────────────────────────────┐
│                                 │
│  ✓                              │  ← large animated checkmark, green
│                                 │
│  Unang Stamp!                   │  ← special copy for first stamp
│  (First Stamp!)                 │
│                                 │
│  Stamp 1/10 para sa             │
│  [merchant name]                │
│                                 │
│  Bagong loyalty card ang        │
│  nagawa para sa customer        │
│                                 │
│  [I-scan ang Susunod] ──────── resets to scan mode
│  [Tingnan ang QR ko]  ──────── goes back to My QR tab
└─────────────────────────────────┘
```

**Celebration moment:** The checkmark should animate (scale-in with a bounce, not just appear). This is the key hook moment — Maria feels it worked, Juan (on his side) sees his card appear.

**What Juan sees at the same time:**
Juan's `/customer` page, if open, shows a loading skeleton replacing the empty state. After data refreshes (next query or manual pull-to-refresh), a new `StampCardDisplay` card appears with 1/10 stamps filled.

---

### Flow 3: Issue Stamp (Returning Customer)

**Entry point:** Same as Flow 2 — merchant scans customer QR. This time, the customer already has a card.

**Difference from Flow 2:** The app detects an existing card (via `findCardForProgram`) and calls `issue_stamp` instead of `create_card_and_stamp`. The UX must distinguish two edge cases.

---

#### Edge Case 3A — Card Has Room for More Stamps

Normal flow. Success screen shows updated count:

```
┌─────────────────────────────────┐
│  ✓                              │
│                                 │
│  Stamp na!                      │
│                                 │
│  Stamp 4/10 para sa             │
│  [merchant name]                │
│                                 │
│  [I-scan ang Susunod]           │
└─────────────────────────────────┘
```

---

#### Edge Case 3B — Card is Full (needs redemption before next stamp)

If `existingCard.currentStamps >= stampsRequired`, do not attempt to issue a stamp. Show:

```
┌─────────────────────────────────┐
│                                 │
│  ★  Full Card!                  │  ← star icon, gold color
│                                 │
│  [customer name / address]      │
│  ay may kumpleto nang card      │
│  para sa inyong programa.       │
│                                 │
│  Sabihin sa customer na         │
│  i-redeem muna ang kanilang     │
│  reward sa kanilang phone.      │
│                                 │
│  [OK, naiintindihan] ──────────  dismisses, goes to scan mode
└─────────────────────────────────┘
```

**Do not attempt to force a stamp on a full card.** The merchant should tell the customer to redeem first. This is a guided prompt, not a blocking error.

---

#### Edge Case 3C — Wrong Program QR

If the scanned customer QR does not correspond to this merchant's program (e.g., merchant accidentally scans a QR from a different app):

```
┌─────────────────────────────────┐
│  ✗                              │  ← red X
│                                 │
│  Di-valid ang QR Code           │
│                                 │
│  Siguraduhing ang customer ay   │
│  nagpapakita ng kanilang Suiki  │
│  QR code.                       │
│                                 │
│  [Subukan Ulit]                 │
└─────────────────────────────────┘
```

---

### Flow 4: Redemption

**Entry point:** Juan opens `/customer`. His card shows 10/10 stamps. A "Redeem" button is visible.

**Goal:** Juan redeems his reward. Stamps reset to 0. He gets the reward description shown as confirmation.

---

#### Screen 4.1 — Card Ready to Redeem

Inside `StampCardDisplay`, when `currentStamps >= stampsRequired`:

```
┌─────────────────────────────────┐
│  [logo] Kape ni Juan            │
│         10/10 stamps ★          │  ← star shows card is complete
│                                 │
│  [● ● ● ● ● ● ● ● ● ●]        │  ← all 10 circles filled, blue
│                                 │
│  ┌───────────────────────────┐  │
│  │  ★  I-redeem ang Reward!  │  │  ← green button, full-width
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

#### Screen 4.2 — Redemption Confirmation Dialog

When Juan taps "I-redeem ang Reward!":

```
┌─────────────────────────────────┐
│                                 │
│  I-redeem na?                   │
│                                 │
│  ┌──────────────────────────┐   │
│  │  Kape ni Juan            │   │
│  │                          │   │
│  │  Reward:                 │   │
│  │  Libreng brewed coffee   │   │  ← merchant's reward_description
│  │                          │   │
│  │  Mire-reset ang inyong   │   │
│  │  stamp count pagkatapos. │   │
│  └──────────────────────────┘   │
│                                 │
│  [I-redeem Na!] ←────────────── primary, green, confirm
│  [Huwag Muna]   ←────────────── secondary, gray, cancel
│                                 │
└─────────────────────────────────┘
```

**This is a modal/bottom sheet, not a full-page navigation.** The confirmation must be explicit — show the reward text so Juan knows exactly what he is redeeming.

---

#### Screen 4.3 — Redemption in Progress

```
┌─────────────────────────────────┐
│  [spinner]                      │
│  Isinasagawa ang redemption...  │
│  Kinokonekta sa SUI...          │
└─────────────────────────────────┘
```

---

#### Screen 4.4 — Redemption Success

```
┌─────────────────────────────────┐
│                                 │
│  ★                              │  ← gold star, large, animated pop
│                                 │
│  Na-redeem na!                  │
│                                 │
│  Ipakita sa merchant:           │
│                                 │
│  ┌──────────────────────────┐   │
│  │  Libreng brewed coffee   │   │  ← reward_description, large text
│  │  @ Kape ni Juan          │   │
│  └──────────────────────────┘   │
│                                 │
│  Bagong card na ang simula —    │
│  Stamp 0/10.                    │
│                                 │
│  [OK]  ──────────────────────── dismisses, card shows 0/10
└─────────────────────────────────┘
```

**Critical:** Juan must show this success screen to Maria as proof of redemption. The reward text must be large enough to read across a counter (minimum 18px font, ideally 22px).

**What happens to the card after redemption:**
The `StampCardDisplay` for Kape ni Juan resets to 0/10 stamps. The `total_earned` counter increments — visible as a small badge: "2x na-redeem" on the card.

---

### Flow 5: Customer Stamp Collection View

**Entry point:** Juan visits `/customer` at any time.

---

#### Screen 5.1 — Empty State (no cards yet)

Shown when wallet is connected but `useMyCards` returns an empty array.

```
┌─────────────────────────────────┐
│  Aking mga Stamp Cards          │
│                                 │
│  ┌─────────────────────────────┐│
│  │     [Customer QR — 180px]   ││  ← always visible
│  │  Ipakita ito sa merchant    ││
│  └─────────────────────────────┘│
│                                 │
│  ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌  │
│                                 │
│  [stamp card illustration]      │  ← simple SVG illustration
│                                 │
│  Wala pa.                       │
│  Bisitahin ang isang Suiki      │
│  merchant at ipakita ang        │
│  inyong QR code para            │
│  kumita ng unang stamp!         │
│                                 │
│  [Hanapin ang Merchant] ──────── → /customer/scan
└─────────────────────────────────┘
```

---

#### Screen 5.2 — Cards List (multiple merchants)

```
┌─────────────────────────────────┐
│  Aking mga Stamp Cards    [3]   │  ← card count badge
│                                 │
│  ┌─────────────────────────────┐│
│  │     [Customer QR — 180px]   ││
│  └─────────────────────────────┘│
│                                 │
│  ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌  │
│                                 │
│  ┌─────────────────────────────┐│
│  │ [logo] Kape ni Juan    1x ✓ ││  ← "1x na-redeem" badge
│  │        6/10 stamps          ││
│  │  [● ● ● ● ● ● ○ ○ ○ ○]   ││  ← filled/empty circles
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ [logo] Ate Helen's Carinderia││
│  │        3/5  stamps          ││
│  │  [● ● ● ○ ○]               ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ [logo] Mang Tonio Barber    ││
│  │        5/5  stamps  ★ READY ││  ← gold star, "I-redeem" button visible
│  │  [● ● ● ● ●]               ││
│  │  [★ I-redeem ang Reward!]  ││  ← green button
│  └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

**Sort order:** Cards ready for redemption (full) appear first. Then sorted by `last_stamped` descending — most recently stamped appears highest.

**Loading state:** Show 2–3 skeleton cards (gray animated placeholder rectangles of the same dimensions) while `useMyCards` is fetching.

---

## 4. Component Specifications

### 4.1 `stamp-card-display.tsx`

**Purpose:** Renders a single customer StampCard NFT. Used in the customer's collection view.

**Props:**
```typescript
interface StampCardDisplayProps {
  card: StampCardData;
  onRedeem?: () => void;       // undefined = no redeem button shown
  redeemLoading?: boolean;     // shows spinner inside button
}
```

**Layout:** Full-width card, white background, rounded-xl corners, 1px border.

**Dimensions:** No fixed height — flexible based on stamps count (more stamps = more rows in the progress grid).

**Sections (top to bottom):**
1. Header row: logo (40x40 rounded-lg), merchant name (font-medium), stamp count text, `total_earned` badge (if > 0)
2. Stamp grid: `StampProgress` component
3. Action row: "I-redeem" button (only when `canRedeem && onRedeem`)

**Logo handling:**
- If `merchantLogo` is empty or fails to load: show a gray placeholder circle with the merchant's first letter
- Use `onError` on the `<img>` to swap to the placeholder

**Visual states:**

| State | Visual treatment |
|-------|-----------------|
| Normal (partial stamps) | White background, gray border |
| Ready to redeem (full) | Subtle gold border (#F59E0B), light yellow background tint (#FFFBEB) |
| Redeeming (loading) | Reduced opacity 0.7, spinner in button |

---

### 4.2 `stamp-progress.tsx`

**Purpose:** Renders the stamp grid — filled and unfilled circles representing stamp progress.

**Props:**
```typescript
interface StampProgressProps {
  current: number;    // stamps earned this cycle
  required: number;   // stamps needed for reward
}
```

**Rendering rules:**
- Circles are 24x24px with 2px border
- Filled circles: `bg-blue-600 border-blue-600 text-white` with checkmark (✓)
- Empty circles: `border-gray-300 text-gray-300` with the stamp number
- Wrap to multiple rows at > 8 stamps (use `flex flex-wrap gap-1.5`)
- For programs with many stamps (e.g., 20+), cap display at 10 circles per row for readability

**Milestone indicators (for stamps_required > 10):**
At every 5th stamp boundary, the circle should be slightly larger (28x28) to mark a milestone. This gives the user psychological progress feedback on long programs.

**Animation:** When a new stamp is added (detected via prop change), the newly-filled circle should animate: scale from 0.8 to 1.0 with a 200ms ease-out. Use CSS transition, not a library.

---

### 4.3 `qr-code.tsx`

**Purpose:** Displays a QR code encoding structured Suiki data.

**Props:**
```typescript
interface QRCodeDisplayProps {
  data: Record<string, string>;  // will be JSON.stringified
  size?: number;                  // default: 256
  label?: string;                 // caption below QR
}
```

**QR code specifications:**
- Error correction level: `"M"` (15% damage recovery — balanced between density and resilience)
- Quiet zone: The component wraps the QR in a white container with 16px padding to ensure adequate quiet zone on any background
- Size: 256px for merchant display (shown to be scanned from across a counter), 180px for customer view (shown to merchant at arm's length)

**Suiki branding overlay:**
A small "S" mark (or Suiki logomark if available) centered in the QR code using `imageSettings` prop of `QRCodeSVG`. If the logo asset is not available at build time, omit the overlay — do not use a placeholder. The QR must remain scannable.

**Container:** White background (`bg-white`), rounded-xl, padding-4. This ensures the QR code is readable against any page background color.

**No dynamic import needed** — `qrcode.react` is client-side only, but the component is already marked `'use client'`.

---

### 4.4 `qr-scanner.tsx`

**Purpose:** Activates the device camera to scan a QR code and returns parsed data.

**Props:**
```typescript
interface QRScannerProps {
  onScan: (data: Record<string, string>) => void;
  onError?: (error: string) => void;
}
```

**Camera permission flow:**

```
User taps "Open Camera" (buksan ang camera)
  │
  ├── Browser asks for camera permission
  │     ├── Granted → camera starts, viewfinder shows
  │     └── Denied  → show error: "Pinigilan ang camera. Payagan sa settings ng browser."
  │
  └── QR detected
        ├── Valid JSON with Suiki keys → parse → call onScan()
        └── Invalid JSON               → call onError("Di-valid ang QR code.")
```

**Viewfinder design:**
- Full-width container, max-width 380px
- Animated scan line (horizontal line sweeping top to bottom, CSS animation, 1.5s loop)
- Corner brackets at the four corners of the scan area to guide framing
- Dim overlay outside the scan box (semi-transparent black) to focus attention

**Scan success animation:**
When a QR is decoded, briefly flash the scan area green (200ms green border pulse) before calling `onScan`. This gives Maria visual confirmation before the state transition.

**Camera facing:**
Always request `{ facingMode: 'environment' }` (rear camera). Do not offer a camera-switch UI in MVP — merchants will always use the rear camera.

**Cleanup:** The `useEffect` cleanup must call `scanner.stop()` to release the camera when the component unmounts. Failure to do so leaves the camera indicator light on — a trust-killer.

---

### 4.5 `connect-wallet.tsx`

**Purpose:** Wraps `@mysten/dapp-kit`'s `ConnectButton` with Suiki-specific styling and state labels.

**Prop interface:** None — reads state from `useCurrentAccount()`.

**Button states:**

| State | Label | Style |
|-------|-------|-------|
| Disconnected | "Ikonekta ang Wallet" | Blue, full-width option |
| Connecting | "Nagkokonekta..." | Blue, disabled, spinner icon |
| Connected | "0x1a2b...3c4d" (truncated) | Gray, outlined, smaller |

**Connected display:**
When connected, show a truncated address: first 6 chars + "..." + last 4 chars. Tapping it should open the dapp-kit disconnect modal (default behavior).

**Placement in layouts:**
- Landing page: Full-width, prominent
- Merchant/Customer page header: Compact, top-right, truncated address
- Inline gate (shown when accessing protected route without wallet): Full-width, centered, with explanation text above it

---

## 5. Mobile-First Design Decisions

### Navigation Structure

**Chosen pattern: Top nav bar + contextual bottom CTAs**

Rationale:
- PWA installed on home screen has no browser URL bar — top nav provides wayfinding
- Bottom area (thumb zone) reserved for primary CTAs on each specific page
- No persistent bottom nav bar in MVP — the app has only two primary roles (merchant/customer) and the landing page routes correctly

**Top nav bar structure:**
```
[Logo/Back button]    [Page title]    [Wallet address]
```

- Back button appears on all sub-pages, never on role home pages
- Wallet address always truncated (0x1a2b...3c4d) — tapping disconnects
- Fixed height: 56px (standard mobile nav touch target)

---

### Thumb-Zone Button Placement

On a 390px wide viewport (iPhone 15 equivalent):

```
┌─────────────────────────┐
│                         │  ← top 30% (hard to reach)
│   Content & data        │     Nav bar lives here
│   display area          │
│                         │
├─────────────────────────┤  ← 50% mark
│                         │  ← bottom 50% (comfortable)
│   Secondary content     │
│                         │
├─────────────────────────┤  ← 70% mark
│                         │  ← bottom 30% (easy reach)
│  [Primary CTA Button]   │     All primary actions here
│  [Secondary action]     │
└─────────────────────────┘
```

All primary CTAs (`submit`, `redeem`, `scan`, `confirm`) must be placed in the bottom 30% of the viewport. Use `sticky bottom-0 p-4` for forms with primary submit buttons.

**Minimum touch target:** 44x44px for all interactive elements (Apple HIG standard, also appropriate for Android). No exceptions.

---

### Loading Skeletons

Show skeletons (animated gray placeholder blocks) for:
- Merchant dashboard card list while `useMyPrograms` is fetching
- Customer stamp collection while `useMyCards` is fetching
- Individual stamp card when `redeemLoading` is true

**Skeleton spec:**
```css
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

Show 2 skeleton cards that match the dimensions of a real `StampCardDisplay`. Never show a blank page with no skeleton — even 100ms of blank white is perceived as broken.

---

### Offline State Handling

SUI network outages are possible (see Design Spec — Risk 3). Handle at three levels:

**Level 1 — Query failure (data shows stale):**
When `useMyCards` or `useMyPrograms` query fails, show the last cached data with a banner:
```
┌────────────────────────────────┐
│ Offline — showing saved data.  │  ← yellow banner, top of content
│ [I-refresh]                    │
└────────────────────────────────┘
```

**Level 2 — Transaction failure (stamp issuance):**
When `execute()` in `useSponsoredTransaction` fails due to a network error, show:
```
┌────────────────────────────────┐
│ Hindi nakumpleto ang stamp.    │
│ Subukan ulit sa ilang segundo. │
│ [Subukan Ulit]  [Kanselahin]   │
└────────────────────────────────┘
```
Do not auto-retry silently — tell the user what happened and give them control.

**Level 3 — Complete offline (no network):**
Browser offline API detection. Show a full-screen banner:
```
Walang internet connection.
Suriin ang inyong WiFi o data.
```
Stamp issuance buttons are disabled when offline.

---

## 6. Filipino MSME UX Considerations

### Bilingual Label Strategy

Use Filipino for emotional / action moments. Use English for technical / status labels.

| UI Element | Language | Example |
|-----------|----------|---------|
| Primary CTAs | Filipino | "Gumawa ng Program", "I-scan", "I-redeem Na!" |
| Form field labels | Mixed | "Pangalan ng Tindahan *" |
| Status messages | Filipino | "Nagde-deploy...", "Tagumpay!" |
| Error messages | Filipino | "Hindi nakakonekta. Subukan ulit." |
| Page titles | English (but simple) | "My Stamp Cards", "Create Program" |
| Technical labels | English | "SUI blockchain", "Slush wallet" |
| Stamp count display | English numerals | "6/10 stamps" |
| Reward descriptions | Merchant's own text | (merchant fills in their language) |

**Do not translate:** "SUI", "Slush", "QR code", "blockchain" — these are proper nouns or widely understood loanwords in Filipino tech contexts.

---

### Low-Bandwidth Optimization

Maria's sari-sari store may have inconsistent LTE signal. Juan may be on a mobile data budget.

**Image handling:**
- All merchant logo images: lazy load with `loading="lazy"`
- Show a gray placeholder circle (CSS only, no image request) until the logo loads
- Logo `onError` handler: swap to first-letter placeholder — never show broken image icon
- QR codes: generated client-side with `qrcode.react` — zero network request

**Font strategy:**
- Use system font stack (`font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — zero font download
- No Google Fonts, no custom webfonts in MVP

**Bundle considerations:**
- `html5-qrcode` is the heaviest dependency (~400KB) — load it only on the scan page using dynamic import:
  ```typescript
  // Only load on the page that actually uses the scanner
  const Html5Qrcode = dynamic(() => import('html5-qrcode').then(m => m.Html5Qrcode), { ssr: false });
  ```
- The PWA service worker (via `next-pwa`) caches app shell on first load — subsequent visits are near-instant even on weak signal

---

### Feature Phone vs Flagship Considerations

**Target baseline:** Android phones with a Chromium-based browser, 2GB RAM, 720p screen. This covers Samsung A14, A15, Xiaomi Redmi 12, and similar mid-range devices common among Filipino MSMEs.

**Camera QR scanning:** `html5-qrcode` works via WebRTC — available on all modern Android browsers. Tested minimum: Chrome 80+. Do not offer file-upload QR fallback in MVP (adds complexity, not needed for the counter interaction).

**Touch event handling:** Use `onClick` not `onMouseDown` — ensures consistent behavior across touch devices. Avoid hover-dependent interactions.

**Screen density:** Use relative units (rem, %) not px for layout. Tailwind's default sizing scale is appropriate. Avoid hardcoding pixel dimensions except for QR code size.

---

### Trust Signals for Blockchain-Skeptical Merchants

Maria has heard "blockchain" in the context of scams. Suiki must proactively address this.

**Trust signal 1 — Zero cost messaging:**
On the landing page and the create-program screen, show clearly:
> "Libre. Walang bayad. Ang SUI blockchain ang nagbabayad ng lahat."
("Free. No charge. The SUI blockchain pays for everything.")

**Trust signal 2 — The word "blockchain" in context:**
Only use "blockchain" when explaining the benefit, not as a feature name. Example:
- Bad: "Your stamps are minted as NFTs on the SUI blockchain"
- Good: "Ang stamps ay nakaimbak sa SUI — hindi mabubura, hindi mababago"
  ("Stamps are stored on SUI — they can't be erased, they can't be changed")

**Trust signal 3 — Known reference points:**
Frame Suiki in terms Maria already trusts: "Para itong GCash pero para sa loyalty stamps." ("It's like GCash but for loyalty stamps.")

**Trust signal 4 — Visible confirmation:**
Every successful transaction shows an explicit success state (not just a silent redirect). Maria needs to see "Tagumpay!" before she believes it worked.

**Trust signal 5 — No surprise screens:**
Maria must never land on a page she doesn't understand. Every protected route (requiring wallet) shows the reason before the connect prompt: "Kailangan ng wallet para pamahalaan ang stamp program." ("A wallet is needed to manage your stamp program.")

---

## 7. Color & Typography System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#2563EB` (blue-600) | Primary CTAs, active states, filled stamps |
| `primary-hover` | `#1D4ED8` (blue-700) | Button hover/active |
| `success` | `#16A34A` (green-600) | Success states, redeem button |
| `success-light` | `#DCFCE7` (green-100) | Success state backgrounds |
| `warning` | `#F59E0B` (amber-500) | Full card ready state, milestone indicators |
| `warning-light` | `#FFFBEB` (amber-50) | Full card background tint |
| `danger` | `#DC2626` (red-600) | Error states, validation messages |
| `neutral-900` | `#111827` | Primary text |
| `neutral-500` | `#6B7280` | Secondary text, helper text |
| `neutral-300` | `#D1D5DB` | Empty stamp circles, borders |
| `neutral-100` | `#F3F4F6` | Page backgrounds, skeleton base |
| `white` | `#FFFFFF` | Cards, QR container background |

### Typography Scale

| Level | Tailwind | Use |
|-------|----------|-----|
| H1 | `text-2xl font-bold` (24px) | Page titles |
| H2 | `text-xl font-bold` (20px) | Section headers, card merchant names |
| H3 | `text-lg font-medium` (18px) | Card labels, modal titles |
| Body | `text-base` (16px) | Default body text |
| Secondary | `text-sm text-gray-500` (14px) | Helper text, subtext |
| Micro | `text-xs` (12px) | Badges, timestamps, fine print |

**Minimum readable text size:** 14px for any text user must read. 12px only for non-critical labels (badge counts, timestamps).

**Reward redemption screen exception:** Reward description text on Screen 4.4 must be `text-xl font-bold` minimum — it will be read across a counter.

---

## 8. Error State Catalog

Complete list of error states the developer must implement.

| ID | Trigger | User-facing message (Filipino) | Recovery action |
|----|---------|-------------------------------|-----------------|
| E01 | Wallet not connected on protected page | "Kailangan ang wallet. Ikonekta muna ang Slush." | Show connect wallet button |
| E02 | Wallet connection rejected by user | "Kinansela ang koneksyon. Subukan ulit." | Show retry button |
| E03 | Slush wallet not installed | "Kailangan ang Slush Wallet. I-download sa slush.org." | Link to slush.org |
| E04 | Form submitted with empty required fields | Inline per-field: "Kailangan itong punan." | Highlight field in red |
| E05 | Invalid logo URL format | "Di-valid ang URL. Tiyaking https:// ang simula." | Highlight field, clear on fix |
| E06 | Camera permission denied | "Pinigilan ang camera. Payagan sa browser settings." | Link to permission help |
| E07 | QR code is not valid JSON | "Di-valid ang QR code. Subukan ulit." | Button to retry scan |
| E08 | QR code is not a Suiki QR | "Hindi ito Suiki QR code." | Button to retry scan |
| E09 | Customer card not found (wrong program) | "Wala pang card ang customer para sa program na ito." | Show create card option |
| E10 | Stamp tx failed (network error) | "Hindi nakumpleto ang stamp. Subukan ulit." | Retry button |
| E11 | Redeem tx failed (not enough stamps) | "Hindi pa kumpleto ang stamps para ma-redeem." | Dismiss — show count |
| E12 | Redeem tx failed (network error) | "Hindi nakumpleto ang redemption. Subukan ulit." | Retry button |
| E13 | Sponsor API error | "Error sa gas sponsorship. Subukan ulit." | Retry button |
| E14 | SUI network offline | "Offline ang SUI network. Subukan ulit mamaya." | Auto-retry indicator |
| E15 | Program not found (bad URL / deleted) | "Hindi nahanap ang programa." | Link back to /merchant |

**Error display rules:**
- Inline form errors: below the field, `text-sm text-red-600`
- Transaction errors: replace the loading state with an error card in the same position
- Network errors: yellow/orange banner at top of content area
- Fatal errors (E03, E15): full-screen centered message with a clear action

---

*Design spec written: 2026-03-25*
*Status: Ready for developer implementation*
*Next: Wireframes / visual mockups (post-MVP)*
