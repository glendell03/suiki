---
title: "Suiki — Sprint 3 Technical Architecture Guide"
date: 2026-03-25
status: authoritative
tags:
  - project/suiki
  - type/architecture
  - stage/implementation
---

# Suiki — Sprint 3 Technical Architecture Guide

> This is the implementation reference for Sprint 3 (Issues 8–12). Developers must read this before writing any new files. It governs component structure, data flow, QR payload format, sponsored transaction handling, error strategy, and build sequencing.

---

## Table of Contents

1. [Sprint 3 Scope Map](#1-sprint-3-scope-map)
2. [Component Dependency Graph](#2-component-dependency-graph)
3. [Page & Route Inventory](#3-page--route-inventory)
4. [QR Payload Format](#4-qr-payload-format)
5. [Issue 10 — Stamp Issuance Flow (Full Spec)](#5-issue-10--stamp-issuance-flow-full-spec)
6. [Rate Limiting Strategy](#6-rate-limiting-strategy)
7. [Error Handling Strategy](#7-error-handling-strategy)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Parallel vs Sequential Build Order](#9-parallel-vs-sequential-build-order)
10. [Performance Considerations for Mobile](#10-performance-considerations-for-mobile)
11. [Architectural Concerns & Risks](#11-architectural-concerns--risks)
12. [Patterns Checklist](#12-patterns-checklist)

---

## 1. Sprint 3 Scope Map

| Issue | Priority | Summary | Owner persona |
|-------|----------|---------|---------------|
| 8 | High | Merchant dashboard + `create/[programId]` pages | Merchant (Maria) |
| 9 | High | QR code generator, QR scanner, stamp-card-display, stamp-progress components | Both |
| 10 | Critical | Merchant stamp issuance flow: scan customer QR → issue stamp on-chain | Merchant (Maria) |
| 11 | Critical | Customer stamp collection view + scan merchant QR page | Customer (Juan) |
| 12 | Medium | Landing page + navigation: route protection, wallet-connect header | Both |

---

## 2. Component Dependency Graph

```
src/
├── app/
│   ├── page.tsx                          [Issue 12]  landing page
│   ├── layout.tsx                        [DONE]      root layout
│   ├── providers.tsx                     [DONE]      QueryClient + DAppKit
│   ├── merchant/
│   │   ├── page.tsx                      [Issue 8]   merchant dashboard
│   │   ├── create/
│   │   │   └── page.tsx                  [Issue 8]   create new program form
│   │   └── [programId]/
│   │       ├── page.tsx                  [Issue 8]   program detail / stamp issuance
│   │       └── scan/
│   │           └── page.tsx              [Issue 10]  QR scanner view
│   └── customer/
│       ├── page.tsx                      [Issue 11]  customer card collection
│       └── scan/
│           └── page.tsx                  [Issue 11]  show my QR to merchant
│
├── components/
│   ├── address-display.tsx               [DONE]
│   ├── connect-wallet.tsx                [DONE]
│   ├── wallet-guard.tsx                  [DONE]
│   ├── nav-header.tsx                    [Issue 12]  wallet connect header
│   ├── qr/
│   │   ├── qr-code.tsx                   [Issue 9]   QR generator (merchant + customer)
│   │   └── qr-scanner.tsx                [Issue 9]   camera-based scanner
│   ├── stamp/
│   │   ├── stamp-card-display.tsx        [Issue 9]   full card UI (merchant logo + stamps)
│   │   ├── stamp-progress.tsx            [Issue 9]   progress bar / stamp grid
│   │   └── stamp-issuance-panel.tsx      [Issue 10]  confirm-stamp action panel
│   └── ui/
│       ├── button.tsx                    [DONE]
│       └── input.tsx                     [DONE]
│
├── hooks/
│   ├── use-my-cards.ts                   [DONE]
│   ├── use-my-programs.ts                [DONE]
│   ├── use-sponsored-tx.ts               [DONE]
│   ├── use-media-query.ts                [DONE]
│   ├── use-scan-customer.ts              [Issue 10]  orchestrates scan → lookup → stamp
│   └── use-customer-card.ts             [Issue 11]  fetches one card by programId
│
└── lib/
    ├── constants.ts                      [DONE]
    ├── queries.ts                        [DONE]   getProgramById, findCardForProgram
    ├── transactions.ts                   [DONE]   buildIssueStamp, buildCreateCardAndStamp
    ├── sui-client.ts                     [DONE]
    └── qr.ts                             [Issue 9]   encode/decode/validate QR payloads
```

### Dependency direction (leaf → root)

```
qr.ts
  └── qr-code.tsx, qr-scanner.tsx
        └── merchant/[programId]/scan/page.tsx
              └── use-scan-customer.ts
                    └── queries.ts, transactions.ts, use-sponsored-tx.ts

stamp-progress.tsx
  └── stamp-card-display.tsx
        └── customer/page.tsx, merchant/[programId]/page.tsx

use-my-programs.ts, use-my-cards.ts
  └── merchant/page.tsx, customer/page.tsx
```

---

## 3. Page & Route Inventory

### Merchant routes

| Path | Guard | Data dependencies |
|------|-------|------------------|
| `/merchant` | `WalletGuard` | `useMyPrograms()` |
| `/merchant/create` | `WalletGuard` | `buildCreateProgram`, `useSponsoredTx` |
| `/merchant/[programId]` | `WalletGuard` | `getProgramById(programId)` |
| `/merchant/[programId]/scan` | `WalletGuard` | QR scanner → `use-scan-customer` |

### Customer routes

| Path | Guard | Data dependencies |
|------|-------|------------------|
| `/customer` | `WalletGuard` | `useMyCards()` |
| `/customer/scan` | `WalletGuard` | `useCurrentAccount()` → render `CustomerQRPayload` |

### Public routes

| Path | Guard | Notes |
|------|-------|-------|
| `/` | none | Redirects authenticated users; shows connect prompt otherwise |

---

## 4. QR Payload Format

The types are already defined in `src/types/sui.ts`. These are the canonical shapes — nothing may deviate from them.

### 4.1 Merchant QR (displayed at point-of-sale)

```ts
// src/types/sui.ts — already exists
interface MerchantQRPayload {
  type: 'merchant';
  programId: SuiObjectId;      // on-chain StampProgram object ID
  merchantAddress: SuiAddress; // merchant wallet address (for verification)
}
```

**Encoding:** `JSON.stringify(payload)` → embed as QR string content.

**Display context:** Merchant shows this QR on `/merchant/[programId]` page. Customer scans it from `/customer/scan` to discover the program.

**Validation on scan (customer side):**
1. Parse JSON.
2. Assert `payload.type === 'merchant'`.
3. Assert `payload.programId` is a 0x-prefixed hex string (object ID format).
4. Call `getProgramById(payload.programId)` to verify the program exists on-chain.
5. Assert `program.merchant === payload.merchantAddress` to prevent spoofed QRs.

### 4.2 Customer QR (shown by customer to merchant)

```ts
// src/types/sui.ts — already exists
interface CustomerQRPayload {
  type: 'customer';
  customerAddress: SuiAddress; // customer wallet address
}
```

**Encoding:** `JSON.stringify(payload)` → embed as QR string content.

**Display context:** Customer shows this QR on `/customer/scan` page. Merchant scans it from `/merchant/[programId]/scan` to issue a stamp.

**Validation on scan (merchant side):**
1. Parse JSON.
2. Assert `payload.type === 'customer'`.
3. Assert `payload.customerAddress` is a valid SUI address (0x-prefixed, 66 chars).
4. Do NOT trust it further — the on-chain Move contract enforces the real authority check (`ctx.sender() == program.merchant`).

### 4.3 Encoding/decoding module

Implement `src/lib/qr.ts` with these four exports:

```ts
// Pure encode — no I/O
function encodeMerchantQR(programId: SuiObjectId, merchantAddress: SuiAddress): string
function encodeCustomerQR(customerAddress: SuiAddress): string

// Parse + runtime-validate; throw on invalid input
function decodeMerchantQR(raw: string): MerchantQRPayload
function decodeCustomerQR(raw: string): CustomerQRPayload

// Type narrowing helper
function decodeQR(raw: string): QRPayload  // dispatches on type field
```

Use `zod` for runtime validation of the decoded JSON if it is already in the dependency tree; otherwise use a manual guard (`typeof x === 'string'` etc.) to keep the bundle lean.

---

## 5. Issue 10 — Stamp Issuance Flow (Full Spec)

This is the most critical user flow. Maria (merchant) opens the scanner, Juan (customer) shows his QR, and a stamp appears on Juan's card — all within 3 taps and ideally under 5 seconds on a mid-range Android.

### 5.1 Sequence diagram

```
Merchant device                  /api/sponsor              SUI blockchain
     │                                │                          │
     │  1. Open /merchant/[id]/scan   │                          │
     │  2. Camera activates           │                          │
     │  3. Scan customer QR           │                          │
     │     → decodeCustomerQR()       │                          │
     │     → customerAddress          │                          │
     │                                │                          │
     │  4. findCardForProgram(         │                          │
     │       customerAddress,          │                          │
     │       programId)               │                          │
     │     ← StampCard | null         │                          │
     │                                │                          │
     │  5a. If card exists:           │                          │
     │      buildIssueStamp(          │                          │
     │        merchantAddr,           │                          │
     │        programId, cardId)      │                          │
     │                                │                          │
     │  5b. If no card:               │                          │
     │      buildCreateCardAndStamp(  │                          │
     │        merchantAddr,           │                          │
     │        programId,              │                          │
     │        customerAddress)        │                          │
     │                                │                          │
     │  6. useSponsoredTx             │                          │
     │     .executeSponsoredTx(tx)    │                          │
     │     → setSender(merchant)      │                          │
     │     → dAppKit.signTransaction()│                          │
     │     → POST /api/sponsor        │                          │
     │       { txKindBytes, sender }  │                          │
     │                                │                          │
     │                                │  7. validate PTB         │
     │                                │     rate-limit check     │
     │                                │     sign as sponsor      │
     │                                │  ← { transactionBytes,  │
     │                                │      sponsorSignature }  │
     │                                │                          │
     │  8. executeTransaction(        │                          │
     │       [userSig, sponsorSig])   │                          │
     │                                │         → on-chain       │
     │                                │           move call      │
     │                                │         ← digest         │
     │                                │                          │
     │  9. waitForTransaction(digest) │                          │
     │ 10. Show success screen        │                          │
     │     invalidate query caches    │                          │
```

### 5.2 The `use-scan-customer` hook

Create `src/hooks/use-scan-customer.ts`. It encapsulates the entire stamp-issuance orchestration and is consumed exclusively by `merchant/[programId]/scan/page.tsx`.

```ts
// Signature (implement in src/hooks/use-scan-customer.ts)
interface UseScanCustomerResult {
  // Call this when the QR scanner decodes a string
  onScan: (rawQR: string) => Promise<void>;

  state: 'idle' | 'looking-up' | 'confirming' | 'pending' | 'success' | 'error';
  customerCard: StampCard | null;   // null = new customer (create_card_and_stamp path)
  error: Error | null;
  digest: string | null;

  // Call this to confirm the stamp issuance after previewing
  confirmStamp: () => Promise<void>;
  reset: () => void;
}

function useScanCustomer(programId: string): UseScanCustomerResult
```

**State machine:**

```
idle
  → (onScan called with valid customer QR)
looking-up
  → (findCardForProgram resolves)
confirming          ← show merchant a preview: "Stamp for [customer addr]? Card: 3/8"
  → (confirmStamp called)
pending             ← useSponsoredTx is running
  → (success)
success             ← show "Stamp issued!" with digest
  → (reset called)
idle
  → (any error at any step)
error               ← show error state with retry
  → (reset called)
idle
```

### 5.3 UX gate: existing card check

```
findCardForProgram(customerAddress, programId)
  → StampCard found:
      branch = 'issue_stamp'
      preview shows: "Card already exists — adding stamp N+1 of X"
  → null:
      branch = 'create_card_and_stamp'
      preview shows: "New customer — creating card with first stamp"
```

Both branches use the same `useSponsoredTx` hook. The only difference is which transaction builder is called.

### 5.4 Confirming before stamping (Issue 10 UX requirement)

The scan must NOT immediately fire the transaction. The flow is:

1. Scan QR → state becomes `confirming`
2. Render `StampIssuancePanel` with the preview (customer address truncated, card state, action label)
3. Maria taps "Mag-stamp" (Issue stamp) button → state becomes `pending`
4. Transaction executes
5. State becomes `success` → show digest, offer to scan next customer

This prevents accidental stamps from mis-scans and gives Maria a chance to abort.

---

## 6. Rate Limiting Strategy

### 6.1 Current server limits (from `src/app/api/sponsor/route.ts`)

```
RATE_LIMIT_MAX = 50 tx per sender per 24-hour window
RATE_LIMIT_MAX = 50 tx per IP per 24-hour window
Window resets: rolling per-key at 24h from first request
```

### 6.2 The 40/50 warning threshold

The sponsor API currently returns a 429 only at the hard limit (50). Sprint 3 must surface a warning to Maria at 40/50 so she can plan around the daily cap.

**Approach:**

The sponsor API does not currently return quota metadata in its success responses. Two options:

**Option A (preferred — no API change):** Add a new API route `GET /api/sponsor/quota?address=0x...` that reads from the same in-memory `rateLimitStore` and returns `{ used: number, max: number, resetAt: number }`. The merchant dashboard calls this on load and after each successful stamp. At `used >= 40`, show a persistent banner: "Malapit na ang limitasyon (40/50 stamps ngayong araw)."

**Option B (simpler — client-only counter):** Keep a `localStorage` counter per merchant address. Increment on every successful `useSponsoredTx` completion. Show warning at 40. This degrades gracefully if the user clears storage — they just lose the warning until next stamp. Does not require a new API endpoint.

Recommendation: implement Option B for Sprint 3 (no new API surface, no Redis dependency), with a TODO comment to migrate to Option A once Redis is in place.

**Client-side counter implementation:**

```ts
// src/lib/quota.ts (new file)
const QUOTA_KEY = (address: string) => `suiki:quota:${address}`;
const QUOTA_MAX = 50;
const QUOTA_WARN = 40;
const WINDOW_MS = 86_400_000;

interface QuotaEntry { count: number; resetAt: number }

function getQuota(address: string): QuotaEntry { ... }
function incrementQuota(address: string): QuotaEntry { ... }
function isNearLimit(address: string): boolean { ... }  // count >= QUOTA_WARN
function isAtLimit(address: string): boolean { ... }    // count >= QUOTA_MAX
```

Call `incrementQuota(merchantAddress)` inside `useSponsoredTx` after a successful digest. Expose `isNearLimit` to the merchant dashboard banner.

Note: the localStorage counter is advisory only. The hard limit is enforced server-side and will surface as a 429 error caught by `useSponsoredTx` → `error` state.

### 6.3 Error message copy for rate limit

When `useSponsoredTx.error` contains "Rate limit exceeded":

```
"Naabot na ang limitasyon. 50 stamps kada araw. Subukan bukas."
("You've reached the limit. 50 stamps per day. Try again tomorrow.")
```

---

## 7. Error Handling Strategy

### 7.1 Error taxonomy

| Layer | Error type | UI response |
|-------|-----------|-------------|
| QR decode | `InvalidQRError` | "Hindi makilala ang QR code. Subukan muli." |
| Network (query) | `QueryError` | React Query `error` state → `ErrorBoundary` fallback |
| Sponsor 429 | Rate limit | Quota warning banner + descriptive copy |
| Sponsor 403 | Validation rejected | Dev bug — log to console, show generic error in prod |
| Sponsor 503 | Config/key issue | "Service temporarily unavailable. Try again later." |
| On-chain failure | `FailedTransaction` | Show `status.error.message` in dev; generic in prod |
| Wallet rejected | User dismissed popup | Silently reset to `idle` — no error toast |

### 7.2 `useSponsoredTx` error surface

The hook already sets `error: Error | null`. Consumers check:

```ts
const { executeSponsoredTx, isPending, error, digest } = useSponsoredTx();

// After calling executeSponsoredTx:
if (error) {
  // Display error.message in a dismissible error card
  // "Wallet rejected" detection:
  if (error.message.toLowerCase().includes('rejected')) return; // silent reset
}
```

### 7.3 React Query error boundaries

Wrap each major page section in an `ErrorBoundary` (use `react-error-boundary` if it is in the dependency tree):

```tsx
<ErrorBoundary fallback={<ErrorCard message="Hindi ma-load ang data." />}>
  <MerchantProgramList />
</ErrorBoundary>
```

Do not use full-page error boundaries — keep failures scoped to the failing widget so the rest of the page remains usable.

### 7.4 Loading states

For every `useQuery` call, implement a skeleton loader rather than a spinner. Skeletons reduce perceived latency on slow mobile connections (relevant for Filipino MSME users on 4G LTE with variable signal).

---

## 8. Data Flow Diagrams

### 8.1 Merchant dashboard load flow

```
/merchant page mounts
  → WalletGuard checks useCurrentAccount()
      → no account: render ConnectWallet prompt
      → account present:
          → useMyPrograms() [queryKey: ['programs', address]]
              → getProgramsByMerchant(address) via suiClient (gRPC)
              → returns StampProgram[]
          → render ProgramCard list
          → each card links to /merchant/[programId]
```

### 8.2 Program creation flow

```
/merchant/create page
  → WalletGuard
  → Form: name, logoUrl, stampsRequired, rewardDescription
  → onSubmit:
      → buildCreateProgram(sender, name, logoUrl, stampsRequired, rewardDescription)
      → useSponsoredTx.executeSponsoredTx(tx)
      → on digest: router.push('/merchant') + cache invalidation
      → on error: show inline error
```

Note: `buildCreateProgram` already sets the sender. `useSponsoredTx` calls `tx.setSender(account.address)` again — this is safe because it's an overwrite of the same value.

### 8.3 Customer card collection load flow

```
/customer page mounts
  → WalletGuard
  → useMyCards() [queryKey: ['cards', address]]
      → getCardsByCustomer(address) via suiClient (gRPC)
      → returns StampCard[]
  → render StampCardDisplay for each card
      → StampProgress (currentStamps / stampsRequired visual)
      → if currentStamps >= stampsRequired: show "Redeem!" CTA
```

### 8.4 Customer QR display flow

```
/customer/scan page mounts
  → WalletGuard
  → useCurrentAccount() → address
  → encodeCustomerQR(address) → JSON string
  → <QrCode value={encoded} />
  → No network calls required — purely local
  → QR is immediately visible (zero loading time, critical for Juan's UX)
```

### 8.5 Merchant scan-and-stamp flow (Issue 10)

```
/merchant/[programId]/scan page mounts
  → WalletGuard
  → useScanCustomer(programId) hook initializes, state = 'idle'
  → <QrScanner onDecode={hook.onScan} />

  Camera running:
  → user points at customer QR
  → QrScanner fires onDecode(rawString)
  → hook.onScan(rawString):
      → decodeCustomerQR(rawString) → CustomerQRPayload
      → state = 'looking-up'
      → findCardForProgram(customerAddress, programId)
      → state = 'confirming', customerCard = result (or null)

  Merchant sees confirm panel:
  → <StampIssuancePanel card={customerCard} program={program} onConfirm={hook.confirmStamp} />
  → Maria taps "Mag-stamp"
  → hook.confirmStamp():
      → if customerCard: buildIssueStamp(merchant, programId, cardId)
      → else: buildCreateCardAndStamp(merchant, programId, customerAddress)
      → state = 'pending'
      → useSponsoredTx.executeSponsoredTx(tx)
      → on digest: state = 'success', incrementQuota(merchantAddress)
      → on error: state = 'error'

  Success screen:
  → show digest (truncated), "Stamp issued!"
  → "Scan next customer" button → hook.reset() → state = 'idle'
```

---

## 9. Parallel vs Sequential Build Order

### Wave 1 — Foundation (all parallel, no inter-dependencies)

These files have no dependency on other Sprint 3 files and can be built simultaneously by different developers:

| File | Issue | Depends on (all Done) |
|------|-------|----------------------|
| `src/lib/qr.ts` | 9 | `src/types/sui.ts` |
| `src/components/stamp/stamp-progress.tsx` | 9 | `src/types/sui.ts` |
| `src/lib/quota.ts` | 10 | nothing |
| `src/components/nav-header.tsx` | 12 | `connect-wallet.tsx` |

### Wave 2 — QR components (after Wave 1)

| File | Issue | Depends on |
|------|-------|-----------|
| `src/components/qr/qr-code.tsx` | 9 | `qr.ts` |
| `src/components/qr/qr-scanner.tsx` | 9 | `qr.ts` |
| `src/components/stamp/stamp-card-display.tsx` | 9 | `stamp-progress.tsx`, `StampCard` type |

### Wave 3 — Hooks (after Wave 1; parallel with Wave 2)

| File | Issue | Depends on |
|------|-------|-----------|
| `src/hooks/use-customer-card.ts` | 11 | `queries.ts` (done), `StampCard` type |
| `src/hooks/use-scan-customer.ts` | 10 | `qr.ts`, `queries.ts`, `transactions.ts`, `use-sponsored-tx.ts` |

### Wave 4 — Pages (after Waves 2 + 3)

| File | Issue | Depends on |
|------|-------|-----------|
| `src/app/merchant/page.tsx` | 8 | `use-my-programs`, `stamp-card-display`, `nav-header`, `wallet-guard` |
| `src/app/merchant/create/page.tsx` | 8 | `use-sponsored-tx`, `transactions.ts`, `nav-header` |
| `src/app/merchant/[programId]/page.tsx` | 8 | `getProgramById`, `stamp-card-display`, `nav-header` |
| `src/app/customer/page.tsx` | 11 | `use-my-cards`, `stamp-card-display`, `nav-header`, `wallet-guard` |
| `src/app/customer/scan/page.tsx` | 11 | `qr-code.tsx`, `encodeCustomerQR`, `nav-header` |
| `src/app/page.tsx` (update) | 12 | `nav-header` |

### Wave 5 — Final integration (must be last)

| File | Issue | Depends on |
|------|-------|-----------|
| `src/app/merchant/[programId]/scan/page.tsx` | 10 | `use-scan-customer`, `qr-scanner`, `stamp-issuance-panel`, `nav-header` |
| `src/components/stamp/stamp-issuance-panel.tsx` | 10 | `StampCard`, `StampProgram` types |

### Summary timeline

```
Wave 1: qr.ts | stamp-progress | quota.ts | nav-header
Wave 2: qr-code | qr-scanner | stamp-card-display       [parallel with Wave 1 output]
Wave 3: use-customer-card | use-scan-customer            [parallel with Wave 2]
Wave 4: all pages except merchant/[id]/scan              [parallel across pages]
Wave 5: stamp-issuance-panel | merchant/[id]/scan/page   [integration]
```

---

## 10. Performance Considerations for Mobile

Target device: mid-range Android (Samsung Galaxy A-series, Xiaomi Redmi). Assume 3–4 GB RAM, 4G LTE with 30–80 ms latency, 720p–1080p screen.

### 10.1 Bundle size

- Do NOT import full icon libraries (`lucide-react`, `heroicons`). Use inline SVG as seen in `wallet-guard.tsx`.
- QR code library: use `qrcode` (lightweight, ~20 KB gzipped) for generation. For scanning, use `html5-qrcode` or the native `BarcodeDetector` API with a polyfill fallback. `html5-qrcode` adds ~80 KB — acceptable given it is only loaded on scanner pages (route-level code splitting via Next.js dynamic imports).

```ts
// Dynamic import for scanner — only loads when scan page is opened
const QrScanner = dynamic(() => import('@/components/qr/qr-scanner'), {
  ssr: false,
  loading: () => <ScannerSkeleton />,
});
```

### 10.2 Camera activation latency

QR scanner page must request camera permission eagerly (on mount) rather than on-demand. Filipino users on mid-range Androids have seen 2–3 second delays on camera start. Pre-warm the camera stream as soon as the scan page renders.

### 10.3 Query stale time

`QueryClient` is configured with `staleTime: 60_000` (60 s). This is appropriate — do not shorten it. After a stamp is issued, `useSponsoredTx` manually invalidates `['programs', address]` and `['cards', address]`, so the UI reflects the new state immediately without waiting for stale expiry.

Also invalidate `['cards', customerAddress]` after a successful stamp (from the merchant's device). This ensures the customer's view is fresh the next time they open the app.

### 10.4 Optimistic UI

For stamp issuance, do NOT use optimistic updates. The stamp count is authoritative on-chain. Show a `pending` loading state until `waitForTransaction` resolves. The SUI testnet typically finalises in 400–800 ms, which is acceptable.

If this proves too slow in user testing, add optimistic updates in a follow-up sprint (post-mainnet approach, not Sprint 3).

### 10.5 Image loading

Merchant logo URLs (`logoUrl` field in `StampProgram`) may be slow or broken. Always render with a fallback:

```tsx
<img
  src={program.logoUrl}
  alt={program.name}
  onError={(e) => { e.currentTarget.src = '/placeholder-logo.png'; }}
  loading="lazy"
/>
```

### 10.6 PWA caching

The customer QR page (`/customer/scan`) must work offline (the customer shows their QR to the merchant — no network needed). Next.js service worker (via `next-pwa` or the built-in App Router caching) must cache this page. The `encodeCustomerQR` call is purely local — it works offline automatically. Ensure the page does not make any `useQuery` calls that would block render.

### 10.7 Tap target sizes

All interactive elements must be at minimum 48 × 48 px (per WCAG 2.5.5). Maria is serving customers with one hand — oversized tap targets reduce mis-tap errors.

---

## 11. Architectural Concerns & Risks

### 11.1 Risk: In-memory rate limiter does not scale (FIND-02)

**Status:** Known, documented with TODO in `src/app/api/sponsor/route.ts`.

**Impact for Sprint 3:** On Vercel/serverless, each cold-start instance has its own memory. A merchant could exceed the 50/day limit across multiple instances without being blocked. The in-memory counter is not shared.

**Mitigation for Sprint 3:** This is acceptable for testnet. The TODO for Redis (`@upstash/ratelimit`) must be executed before mainnet. Do not block Sprint 3 on this.

**Mitigation now:** The client-side `quota.ts` counter provides a user-facing warning even if the server-side limit is not perfectly enforced in multi-instance deployments.

### 11.2 Risk: `getProgramsByMerchant` scans all shared objects

**Status:** Architectural limitation documented in `src/lib/queries.ts`.

`listOwnedObjects` with the zero-address owner to enumerate shared objects of a specific type is not guaranteed to be efficient at scale. As the number of `StampProgram` objects grows, this query will slow down.

**Mitigation for Sprint 3:** Acceptable for testnet with low object counts. Add a `limit` parameter and cursor-based pagination to the query before mainnet. Add a TODO comment.

### 11.3 Risk: QR payload has no signature / HMAC

The `CustomerQRPayload` contains only a wallet address. Anyone who knows a wallet address can generate a valid-looking customer QR. The on-chain Move contract is the actual authority (it checks `ctx.sender() == program.merchant` for stamp issuance), so a fake customer QR would create a stamp card for an arbitrary address — which only hurts the fake-QR holder (they get no real card), not the merchant.

**Verdict:** Not a security risk in the current model. Stamps are owned by the `program.merchant` address on-chain, so the merchant's wallet signature is the real authorization. Document this in the `qr.ts` module with a comment.

### 11.4 Risk: `SuiGrpcClient` used client-side in providers

`src/app/providers.tsx` instantiates `SuiGrpcClient` on the client. The AGENTS.md says "Never use the JSON-RPC `SuiClient` on the server" and "Always use `SuiGrpcClient` from `@mysten/sui/grpc` for server-side RPC calls." Providers.tsx uses gRPC on the client side through dAppKit — this is the correct pattern for dAppKit. The server singleton in `sui-client.ts` is also gRPC. No violation.

**Verdict:** No action needed.

### 11.5 Risk: `use-sponsored-tx` only invalidates merchant's caches

After issuing a stamp, the hook invalidates `['programs', account.address]` and `['cards', account.address]` — where `account` is the merchant. The customer's `['cards', customerAddress]` cache is not invalidated.

**Implication:** If Juan opens the app immediately after Maria stamps his card (on a different device), he will see stale stamp counts until the 60 s stale time expires.

**Mitigation:** In `use-scan-customer.ts`, after a successful stamp, also call:
```ts
await queryClient.invalidateQueries({ queryKey: ['cards', customerAddress] });
```
This is a best-effort invalidation (Juan's device is a different process), but it ensures correctness if both users are on the same browser session (e.g. demo mode).

### 11.6 Concern: No redemption flow in Sprint 3 issues

`buildRedeem` exists in `transactions.ts`. Issues 8–12 do not explicitly include a redemption UI. The customer's stamp card will show "Redeem!" when `currentStamps >= stampsRequired`, but the transaction flow is not specified in the sprint.

**Recommendation:** Add a redemption CTA on the `StampCardDisplay` component with a `TODO: Issue 13` comment. Wire the `buildRedeem` call so it is easy to enable in the next sprint without rework.

---

## 12. Patterns Checklist

Every new file written in Sprint 3 must conform to these patterns drawn from the existing codebase.

### Client components

- Add `'use client';` as the first line for any component using hooks or browser APIs.
- Import hooks from `@mysten/dapp-kit-react` (never the old `@mysten/dapp-kit`).
- Use `useCurrentAccount()` to get the connected wallet; never read from localStorage directly.

### Server components / API routes

- Never instantiate a new `SuiGrpcClient` — import `suiClient` from `@/lib/sui-client`.
- Never use `NEXT_PUBLIC_` env vars for secret values.

### Styling

- Use `--color-*` CSS custom properties (defined in `globals.css`) — never hardcode colors.
- Use `min-h-[100dvh]` (not `min-h-screen`) for full-viewport elements on mobile PWA.
- All interactive targets: minimum 48 × 48 px.
- Mobile-first: design for 375 px width; add `sm:` breakpoints for larger screens.

### Transactions

- Build transactions with the builders in `src/lib/transactions.ts` — never call `tx.moveCall` inline in components.
- Always go through `useSponsoredTx` — never call `signAndExecuteTransaction` directly (gas must be sponsored).

### Types

- Use branded types: `SuiAddress` and `SuiObjectId` from `src/types/sui.ts`.
- Cast raw strings with `asSuiAddress()` / `asSuiObjectId()` at the RPC boundary; never cast inside business logic.

### Query keys

Follow the existing convention:

```ts
['programs', merchantAddress]   // useMyPrograms
['cards', customerAddress]      // useMyCards
['program', programId]          // getProgramById (new in Sprint 3)
['card', programId, customerAddress]  // findCardForProgram (new in Sprint 3)
```

### Filipino language copy

- Use Tagalog for all user-facing copy (labels, confirmations, error messages, empty states).
- Use English for technical debug information and console logs.
- Maintain the tone established in `WalletGuard`: warm, direct, trust-building.

---

*Document owner: CTO Agent. Last updated: 2026-03-25. Review before Sprint 4 begins.*
