---
title: "Suiki — QR-Based Stamp Flow Security Audit"
date: 2026-03-26
status: open
auditor: Claude Sonnet 4.6 (AI Security Review)
scope: src/lib/qr-utils.ts, src/app/customer/scan/page.tsx, src/app/api/sponsor/route.ts, src/lib/rate-limit.ts, next.config.ts, public/manifest.json
version: post-security-audit.md (SEC-01 through SEC-13) fixes; QR redesign pre-launch
tags:
  - project/suiki
  - security/audit
  - blockchain/sui
  - type/security-report
  - qr/stamp-flow
created: 2026-03-26
updated: 2026-03-26
---

# QR-Based Stamp Flow Security Audit

## Executive Summary

The redesigned Suiki QR stamp flow carries **medium overall risk** prior to launch. The
blockchain layer provides robust replay and self-award protection — every stamp is an
on-chain transaction the Move contract validates independently of the QR payload. Three
findings require action before launch: the QR payload lacks a time-bounded nonce (replay
window), the `cardId` extracted from QR data is not validated as a well-formed Sui object
ID before use in transactions, and the `rate-limit.ts` implementation is client-side only
and trivially bypassable. Two CSP gaps (missing `worker-src` and `manifest-src` directives,
and `media-src blob:` for camera streams) have been corrected in `next.config.ts`.

---

## Threat Model

### Assets at Risk

| Asset | Value | Notes |
|-------|-------|-------|
| Stamp credits on-chain | High | Fraudulent stamps translate to redeemed rewards (free goods/services) |
| Customer wallet address | Low-medium | Public on Sui; QR exposure is a privacy surface, not a funds surface |
| Merchant gas (via sponsor) | Medium | `/api/sponsor` is the gas payer; abuse drains the sponsor wallet |
| Merchant reputation | Medium | Fraudulent stamps undermine loyalty program integrity |
| Customer privacy | Low | Wallet address visible in QR; Sui addresses are public by design |

### Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| Dishonest customer | Can view/screenshot their own QR; can craft arbitrary QR strings | Free rewards via forged or replayed stamps |
| Dishonest merchant employee | Has physical access to scanner app; can screenshot customer QR | Issue stamps to confederates or sell stamp credits |
| External attacker | Can forge QR codes targeting any known wallet address | Drain sponsor gas; disrupt loyalty programs |
| Malicious merchant | Controls their QR display; can show QR with manipulated payload | If QR is merchant-generated (it is not in current design — customer shows QR) |

### Attack Surface

1. QR payload content — unsigned, base64-encoded JSON
2. Merchant scanner — QR decode → transaction build path
3. `/api/sponsor` route — gas sponsorship API
4. Client-side rate limiting in `rate-limit.ts`
5. PWA manifest and service worker
6. CSP headers in `next.config.ts`

---

## Findings

---

### CRITICAL (must fix before launch)

No Critical findings identified. The most dangerous class of attack — a customer awarding
themselves stamps without merchant involvement — is blocked at the Move contract layer. See
HIGH-01 and HIGH-02 for launch-blocking issues.

---

### HIGH (fix before launch)

#### QR-HIGH-01 — No Time-Bounded Nonce: Replay Window Exists

- **Title:** QR payload has no expiry; a screenshotted QR can be replayed indefinitely
- **Description:**
  The customer QR payload (`v1:base64({ type, cardId, walletAddress })`) contains no
  timestamp or single-use nonce. A merchant employee who screenshots the customer's QR
  during a legitimate visit can scan it again later — or sell it — and the scanner will
  generate a valid `issue_stamp` transaction.

  The blockchain does prevent infinite stamps: the Move `issue_stamp` function is gated
  on the merchant's capability object and the card being in a valid state. However, each
  replay costs the merchant one legitimate stamp issuance slot (gas is sponsored, so there
  is no financial cost friction). More critically, a dishonest employee can scan the
  screenshot multiple times in one session before the merchant notices the anomalous
  on-chain count.

- **Impact:**
  A single screenshotted QR can generate unlimited stamps for any wallet that holds the
  matching `cardId` object, bounded only by the client-side daily rate limit (which is
  also bypassable — see MED-01).

- **Recommendation:**
  Add a `exp` (expiry) Unix timestamp to the QR payload, set to `Date.now() + 5 minutes`
  at display time. The merchant scanner must reject payloads where `exp < Date.now()`.

- **Implementation:**
  ```typescript
  // In qr-utils.ts — extend CardScanPayloadData
  interface CardScanPayloadData {
    type: 'card_scan';
    cardId: string;
    walletAddress: string;
    exp: number; // Unix ms — QR is invalid after this time
  }

  // Encoding (customer card display page)
  export function encodeCustomerCardQR(cardId: string, walletAddress: string): string {
    const exp = Date.now() + 5 * 60 * 1000; // 5 minutes
    const data: CardScanPayloadData = { type: 'card_scan', cardId, walletAddress, exp };
    return QR_VERSION_PREFIX + btoa(JSON.stringify(data));
  }

  // Decoding (merchant scanner) — add expiry check
  if (typeof obj['exp'] === 'number' && Date.now() > obj['exp']) {
    return { type: 'unknown' }; // expired — treat as unrecognised
  }
  ```

  The customer QR display component should re-render the QR every 4 minutes (inside the
  5-minute window) so a legitimate customer always has a fresh code.

  **Note on clock skew:** Merchant devices may have clocks slightly ahead of the
  customer's device. Use a 30-second grace period: `Date.now() > exp + 30_000` as the
  rejection condition, giving a 5.5-minute effective validity window.

---

#### QR-HIGH-02 — `cardId` Not Validated as Sui Object ID Before Transaction Use

- **Title:** Malformed `cardId` from QR payload passes to transaction builder without format validation
- **Description:**
  `decodeQRPayload` in `qr-utils.ts` coerces `cardId` with `String()` and checks that it
  is truthy, but does not validate that it is a well-formed Sui object ID
  (`0x`-prefixed, 64 hex characters). The returned `cardId` is consumed by the merchant
  scanner to build an `issue_stamp` transaction.

  An attacker who crafts a QR with `cardId: "../../evil"` or a 1-MB string passes the
  truthy check. The Sui SDK's transaction builder will ultimately reject a malformed object
  ID, but the rejection occurs after the sponsor API has already been called and rate-limit
  quota consumed. More importantly, a sufficiently long `cardId` could cause issues in any
  string manipulation code between decode and transaction build.

- **Impact:**
  Crafted QR codes can waste sponsor API quota; edge cases in downstream string handling
  could cause unexpected errors.

- **Recommendation:**
  Add Sui object ID format validation in `decodeQRPayload`:
  ```typescript
  const SUI_OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;
  const SUI_ADDRESS_RE   = /^0x[0-9a-fA-F]{64}$/;

  if (!SUI_OBJECT_ID_RE.test(String(cardId))) return { type: 'unknown' };
  if (!SUI_ADDRESS_RE.test(String(walletAddress))) return { type: 'unknown' };
  ```
  Both `cardId` (a Sui object ID) and `walletAddress` are 0x-prefixed 64-hex strings.
  Reject any payload where either field does not match this pattern.

---

### MEDIUM (fix within 30 days)

#### QR-MED-01 — Client-Side Rate Limit Is Trivially Bypassable

- **Title:** `rate-limit.ts` uses `localStorage` — any customer can clear it and reset their quota
- **Description:**
  `src/lib/rate-limit.ts` stores the merchant's daily stamp-transaction counter in
  `localStorage` keyed by `suiki_daily_tx_YYYY-MM-DD_<merchantAddress>`. A customer who
  knows this key format (it is in the source code) can call
  `localStorage.removeItem(key)` in the browser console and immediately reset their
  counter, bypassing the 50-transaction-per-day soft limit entirely.

  More broadly, `rate-limit.ts` limits merchant-side stamp issuance, not customer-side QR
  abuse. A customer cannot directly call the stamp transaction — the merchant's scanner
  initiates it — so this control is not the primary defence against customer fraud.
  However, it is the only client-side guard against a rogue merchant employee issuing
  unlimited stamps to themselves.

- **Impact:**
  A rogue merchant employee or a customer with console access to the merchant scanner can
  reset the rate limit and issue unlimited stamps (bounded only by the server-side
  `/api/sponsor` rate limit of 50 transactions per IP/address per 24 hours).

- **Recommendation:**
  The client-side limit should be understood as a UX-level soft guard, not a security
  control. Move the authoritative rate limit to the server: implement a Redis-backed
  per-merchant-address limit in `/api/sponsor/route.ts` (a `TODO` already exists in the
  file). Until Redis is in place, document that the 50-transaction cap is advisory only.

---

#### QR-MED-02 — Customer QR Encodes Raw Wallet Address Without Contextual Binding

- **Title:** QR payload is not bound to a specific merchant or session
- **Description:**
  The customer QR payload contains `{ type, cardId, walletAddress }`. A merchant
  employee who scans this QR could, in theory, also use the decoded `walletAddress` to
  look up the customer's full on-chain history across all Sui dApps. Because Sui addresses
  are public, this is not a cryptographic vulnerability, but it is a privacy surface: the
  QR code is a physical artifact that a camera can capture and that exposes a persistent
  identifier linked to all of a customer's on-chain activity.

  Additionally, the payload is not bound to a specific `programId`. A dishonest merchant
  could scan the QR at one of their programs and then reuse the decoded `cardId` and
  `walletAddress` to attempt stamps on a different program (if a `cardId` object is shared
  across programs, which the current Move contract does not permit — each card is specific
  to one program). This is not currently exploitable but is worth noting for future
  contract changes.

- **Impact:**
  Privacy exposure of wallet address via QR photograph; no direct funds risk.

- **Recommendation:**
  1. Add the `exp` nonce from QR-HIGH-01, which limits the utility of a photographed QR.
  2. Consider adding `programId` to the customer QR payload so the scanner can verify the
     payload is intended for the program being stamped. This provides defence-in-depth
     even if the Move contract is later changed.
  3. Document in user-facing copy that the QR contains the customer's public wallet
     address and should not be shared with untrusted parties.

---

#### QR-MED-03 — `beautiful-qr-code` Fetches Logo URLs via `fetch()` — External Logo Risk

- **Title:** If an external logo URL is supplied to `BeautifulQR`, CSP will block it silently
- **Description:**
  The `beautiful-qr-code` library (`node_modules/beautiful-qr-code/dist/index.mjs:19`)
  calls `fetch(logoUrl)` to convert a logo URL to a `data:` URL before embedding it in
  the SVG. If `logoUrl` is a same-origin path (e.g. `/icons/icon-192.png`), this fetch is
  permitted by `connect-src 'self'` and works correctly.

  If a future developer passes an external URL (e.g.
  `https://cdn.example.com/logo.png`), the `connect-src` directive will block the fetch
  silently in the browser (the library catches the error and logs it). The QR will render
  without a logo — no security breach, but a confusing silent failure.

- **Impact:**
  Potential silent logo-rendering failure if external logo URLs are ever used; no security
  bypass.

- **Recommendation:**
  Always pass `data:` URI or same-origin paths for the logo option. Add a lint rule or
  code comment in the `BeautifulQR` component that documents this constraint. If an
  external logo ever becomes a product requirement, add the specific origin to
  `connect-src` with documented justification.

---

### LOW (fix within 90 days)

#### QR-LOW-01 — `asSuiAddress` Cast Has No Runtime Validation (Carried from SEC-13)

- **Title:** Customer wallet address passed to QR encoder is not validated at encoding time
- **Description:**
  In `src/app/customer/scan/page.tsx:170`, `asSuiAddress(customerAddress)` is used to
  create the customer QR payload. As noted in SEC-13 of the prior audit, `asSuiAddress`
  is a compile-time cast with no runtime check. The `customerAddress` value comes from
  `useCurrentAccount().address`, which the `@mysten/dapp-kit-react` SDK always provides
  as a valid Sui address — so this is not currently exploitable.

  However, the encoding path (`encodeCustomerCardQR`) also accepts raw strings without
  any format guard. A future refactor that supplies an unvalidated string to the encoder
  would silently embed a malformed address in the QR.

- **Recommendation:**
  Add a `SUI_ADDRESS_RE` guard at the top of `encodeCustomerCardQR` and
  `encodeRewardClaimQR` that throws if the address is malformed. This is a 2-line change
  and prevents silent encoding of invalid addresses.

---

#### QR-LOW-02 — `parseQRPayload` (Old Format) and `decodeQRPayload` (New Format) Coexist

- **Title:** Two QR payload parsers exist; only one validates the new `v1:` format
- **Description:**
  `qr-utils.ts` exports two distinct parsing functions:
  - `parseQRPayload` — parses the legacy JSON-only format (`{ type: 'merchant' | 'customer', ... }`)
  - `decodeQRPayload` — parses the new `v1:base64(...)` compact format

  `src/app/customer/scan/page.tsx` uses `parseQRPayload` for merchant QR codes (which
  still use the JSON format). The merchant scanner (not yet built) will use
  `decodeQRPayload` for customer QR codes. This split is intentional and documented in the
  module header.

  The risk is that a future developer calls the wrong parser for a given QR type, leading
  to silent parse failures that surface only at runtime.

- **Recommendation:**
  Add a JSDoc `@see` cross-reference between the two functions, explicitly documenting
  which QR types each one handles. Consider adding a single `parseAnyQR` dispatcher
  that selects the correct parser based on whether the input starts with `v1:`.

---

#### QR-LOW-03 — No Server-Side Validation That `cardId` Belongs to `walletAddress`

- **Title:** The sponsor API does not verify the card/wallet relationship before signing
- **Description:**
  `/api/sponsor/route.ts` validates that the PTB targets an allowed function, but it does
  not verify that the `cardId` argument in the `issue_stamp` call actually belongs to the
  `walletAddress` (the customer). This check is performed by the Move contract on-chain
  (`assert!(card.owner == ctx.sender(), ENotCardOwner)`), but a malicious client could
  submit a PTB with a `cardId` belonging to a different wallet.

  The on-chain check will reject the transaction, costing the sponsor its gas-budget slot
  and consuming rate-limit quota for the legitimate sender. This is an economic nuisance,
  not a security breach.

- **Recommendation:**
  Consider a lightweight off-chain pre-flight check in the sponsor route: fetch the card
  object's `owner` field via `suiClient` and reject the sponsorship if it does not match
  the `sender`. This reduces wasted gas on obviously-invalid requests.

---

### INFORMATIONAL

#### QR-INFO-01 — Blockchain Layer Provides Strong Replay Defence

The Sui Move contract is the authoritative last line of defence. Even if a QR is replayed,
forged, or the client-side rate limit is bypassed, the on-chain invariants hold:

- `issue_stamp` requires the caller to hold the `MerchantCap` for the program. Customers
  cannot call it themselves.
- Each stamp increments an on-chain counter; the contract enforces `current_stamps <=
  stamps_required`.
- `redeem` burns the card's stamp count atomically; double-redemption is impossible.
- Gas sponsorship requires the sponsor's signature — the client cannot sign on behalf of
  the sponsor.

These on-chain guarantees mean that the most severe outcome of a QR exploit is one
illegitimate stamp per scan, not unlimited stamps or fund loss.

#### QR-INFO-02 — Wallet Address in QR Is by Design (Sui Addresses Are Public)

Sui wallet addresses are public identifiers — knowing someone's address does not grant
spending authority. The wallet address in the QR is equivalent to a loyalty card number:
it identifies the customer but cannot be used to steal funds. This is documented and
acceptable in the Sui ecosystem.

#### QR-INFO-03 — `html5-qrcode` Does Not Load External Resources

Confirmed via source inspection: `html5-qrcode` has no CDN runtime dependency. The
`unpkg` field in its `package.json` is a distribution channel declaration, not a runtime
fetch. The library uses the browser's native `MediaDevices.getUserMedia` API for camera
access, which requires no additional CSP changes beyond the existing `camera=(self)` in
`Permissions-Policy`.

---

## QR Payload Recommendations

### Current Payload (Launch Candidate — Before QR-HIGH-01 Fix)

```
v1:{base64(JSON.stringify({ type, cardId, walletAddress }))}
```

**Problems:** No expiry, no programme binding.

### Recommended Payload (Post QR-HIGH-01 + QR-MED-02 Fix)

```
v1:{base64(JSON.stringify({ type, cardId, walletAddress, programId, exp }))}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'card_scan' \| 'reward_claim'` | Discriminator |
| `cardId` | `0x`-prefixed 64-hex string | On-chain StampCard object ID |
| `walletAddress` | `0x`-prefixed 64-hex string | Customer's Sui address |
| `programId` | `0x`-prefixed 64-hex string | Stamp program the QR is for |
| `exp` | Unix milliseconds | QR expiry — `Date.now() + 5 * 60 * 1000` at encode time |

**Verification rules in `decodeQRPayload`:**

1. Starts with `v1:`
2. Base64 decodes to valid JSON object
3. `type` is `'card_scan'` or `'reward_claim'`
4. `cardId` matches `/^0x[0-9a-fA-F]{64}$/`
5. `walletAddress` matches `/^0x[0-9a-fA-F]{64}$/`
6. `programId` matches `/^0x[0-9a-fA-F]{64}$/`
7. `exp` is a number and `Date.now() <= exp + 30_000` (30-second grace for clock skew)

**QR re-generation:** The customer display component should regenerate the QR every
4 minutes to keep the code within its 5-minute window.

**Backward compatibility:** The `v1:` version prefix allows a future `v2:` format for
signed payloads if HMAC authentication is added later.

### Signature Discussion (HMAC vs. On-Chain Verification)

Adding a cryptographic signature to the QR payload was considered:

- **HMAC with a server secret:** Requires an HTTP round-trip to the server at QR display
  time (to generate the HMAC) and at scan time (to verify). This adds latency and server
  load, and requires the HMAC secret to be kept server-side (cannot be in the client
  bundle). The benefit is that a forged `walletAddress` or `cardId` would fail
  verification before any blockchain call is made.

- **Wallet private key signature:** The customer's wallet could sign the payload
  (`cardId + walletAddress + exp`). This requires a wallet interaction at QR display time,
  breaking the "show QR instantly" UX flow. Verification would require the merchant app to
  call `verifyPersonalMessageSignature` from `@mysten/sui`, which is a client-side call —
  no server needed, but adds complexity.

**Decision for this release:** The expiry nonce (QR-HIGH-01) is the minimum viable
mitigation. The replay window is reduced from "infinite" to 5 minutes. HMAC or wallet
signatures should be evaluated for a future hardening pass if stamp fraud is observed in
production.

---

## CSP Audit

### Current State (Before This Audit)

| Directive | Value | Assessment |
|-----------|-------|------------|
| `default-src` | `'self'` | Correct |
| `script-src` | `'self' 'unsafe-inline'` (prod) | Acceptable; nonce migration tracked |
| `style-src` | `'self' 'unsafe-inline'` | Acceptable for Tailwind v4 + inline styles |
| `img-src` | `'self' data: blob:` | Correct |
| `font-src` | `'self'` | Correct |
| `connect-src` | `'self'` + Sui fullnode URLs | Correct |
| `Permissions-Policy camera` | `(self)` | Correct for `html5-qrcode` |
| `worker-src` | **MISSING** | Gap — service worker may fail in strict browsers |
| `manifest-src` | **MISSING** | Gap — PWA manifest fetch may be blocked |
| `media-src` | **MISSING** | Gap — `html5-qrcode` uses `blob:` for camera streams |

### Changes Made in `next.config.ts`

Three directives were added (file: `/Users/glendell/projects/suiki/Suiki/next.config.ts`):

#### 1. `worker-src 'self'` (QR-SEC-01)

```
worker-src 'self'
```

**Rationale:** `@ducanh2912/next-pwa` registers a service worker at runtime. The
`worker-src` directive controls which URLs can be used as service worker scripts. Without
it, browsers fall back to `child-src`, which falls back to `default-src 'self'` — so
the SW currently works. However, `worker-src` is the specified standard and its explicit
presence removes reliance on fallback chain behaviour that may change across browser
versions. No new origins are added.

#### 2. `manifest-src 'self'` (QR-SEC-01)

```
manifest-src 'self'
```

**Rationale:** Controls which URLs can be used as a web app manifest. Firefox 109+
enforces `manifest-src` independently. Without it, Firefox falls back to `default-src
'self'`, which would work, but explicit declaration is more predictable and shows
intent. No new origins are added.

#### 3. `media-src 'self' blob:` (QR-SEC-02)

```
media-src 'self' blob:
```

**Rationale:** `html5-qrcode` attaches the camera `MediaStream` to a `<video>` element
via `URL.createObjectURL(stream)`, producing a `blob:` URL as the `src`. Without
`media-src blob:`, this video element will be blocked by the CSP, causing the camera
preview — and therefore the entire merchant scanner — to fail silently. `blob:` in
`media-src` is restricted to blobs created by the same origin's JavaScript, not to
arbitrary external blob URLs. This is the minimal necessary addition.

### Directives Not Requiring Changes

| Library / Feature | Assessment |
|-------------------|------------|
| `beautiful-qr-code` logo fetch | Same-origin fetch only; `connect-src 'self'` sufficient |
| Glassmorphism CSS blur (`backdrop-filter`) | Pure CSS; no CSP directive needed |
| Glassmorphism inline styles | `style-src 'unsafe-inline'` already present |
| `html5-qrcode` camera permission | `Permissions-Policy camera=(self)` already present |
| QR canvas `toDataURL()` | `img-src data:` already present |
| SVG QR download blob | `img-src blob:` already present |

### Remaining CSP Debt

| Item | Severity | Tracking |
|------|----------|---------|
| Remove `unsafe-inline` from `script-src` via nonce-based middleware | Medium | SEC-06 (prior audit) — tracked, not in scope for this release |
| Remove `unsafe-inline` from `style-src` via Tailwind CSS purge + nonce | Low | Long-term; Tailwind v4 CSS variable approach reduces inline style dependency |

---

## Acceptance Criteria (Security)

Security sign-off checklist before QR stamp flow launch:

- [ ] **QR-HIGH-01 resolved:** `exp` field added to `CardScanPayloadData` and
      `RewardClaimPayloadData`; `decodeQRPayload` rejects expired payloads; customer QR
      component regenerates code every 4 minutes
- [ ] **QR-HIGH-02 resolved:** `decodeQRPayload` validates `cardId` and `walletAddress`
      against `/^0x[0-9a-fA-F]{64}$/` before returning a typed payload
- [ ] **QR-MED-01 acknowledged:** `rate-limit.ts` documented as advisory-only UX guard;
      Redis-backed server-side rate limit in `/api/sponsor` is the authoritative control
      (already present at 50 tx/day per sender and per IP)
- [ ] **CSP `worker-src 'self'`** present in production CSP header
- [ ] **CSP `manifest-src 'self'`** present in production CSP header
- [ ] **CSP `media-src 'self' blob:`** present in production CSP header
- [ ] `SPONSOR_PRIVATE_KEY` confirmed server-only (no `NEXT_PUBLIC_` prefix; declared
      under `server:` in `src/env.ts` — verified)
- [ ] QR payload format documented in `qr-utils.ts` JSDoc for all encoding functions
- [ ] Manual test: merchant scanner rejects a QR replayed after 5 minutes 30 seconds
- [ ] Manual test: merchant scanner rejects a QR with a malformed `cardId`
- [ ] Manual test: camera preview works on merchant scanner page in Chrome and Firefox
      (validates `media-src blob:`)
- [ ] PWA install prompt works on Chrome Android after CSP changes (validates
      `manifest-src 'self'` and `worker-src 'self'`)
- [ ] Professional Move contract audit completed before mainnet (recommendation from prior
      audit — not in scope here but still open)

---

*Audit date: 2026-03-26*
*Auditor: Claude Sonnet 4.6 (AI Security Review — not a substitute for a professional smart contract or web security audit)*
*Prior audit reference: `Docs/security-audit.md` (Round 2, same date)*
