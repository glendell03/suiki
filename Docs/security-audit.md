---
title: "Suiki — Deep Security Audit (Round 2)"
date: 2026-03-26
status: open
auditor: Claude Sonnet 4.6 (AI Security Review)
scope: src/app/api/sponsor/route.ts, src/hooks/use-sponsored-tx.ts, src/env.ts, src/lib/sui-client.ts, src/lib/constants.ts, move/suiki/sources/suiki.move, next.config.ts
version: post-FIND-01/16/02/04/06/08 fixes
tags:
  - project/suiki
  - security/audit
  - blockchain/sui
  - type/security-report
created: 2026-03-26
updated: 2026-03-26
---

# Suiki — Deep Security Audit (Round 2)

> **Scope:** Gas sponsor API (`/api/sponsor`), client transaction hook, environment configuration, server client, Move contract, and Next.js security headers. This audit covers the current code state after prior remediation (FIND-01 through FIND-16 from `Docs/Security Audit.md`) and identifies new or residual issues in the live implementation.

---

## Prior Audit Status

The following Critical and High findings from the prior audit (`Docs/Security Audit.md`, dated 2026-03-25) have been confirmed **resolved** in the current code:

| Prior Finding | Status | Evidence |
|---|---|---|
| FIND-01 (Critical) — Unrestricted sponsoring | Fixed | `validateAllCommands()` in route.ts:126-161 rejects all non-MoveCall commands and non-suiki targets |
| FIND-16 (High) — Only first PTB command checked | Fixed | `for...of` loop at route.ts:134 iterates all commands |
| FIND-02 (High) — Rate limit per address only | Partially fixed | Dual sender + IP limiting added; in-memory store acknowledged as pre-mainnet stub |
| FIND-04 (High) — `stamps_required = 0` | Fixed | `assert!(stamps_required > 0, EInvalidStampsRequired)` at suiki.move:125 |
| FIND-06 (Medium) — Excess stamps lost on redemption | Fixed | Carry-forward logic at suiki.move:220-222 |
| FIND-08 (Medium) — No merchant transfer | Fixed | `transfer_merchant()` at suiki.move:271-285 |

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Immediate, potentially irreversible financial loss or total system compromise |
| **High** | Significant harm with a realistic exploit path — wallet drain, auth bypass, or persistent DoS |
| **Medium** | Degrades integrity, availability, or security posture in ways that are exploitable with moderate effort |
| **Low** | Limited blast radius; requires unusual conditions or significant attacker effort |
| **Info** | Correctness observations with no direct exploit path; best-practice notes |

---

## Findings

---

### SEC-01 — Sender Address Accepted Without Format Validation

**Severity:** High
**File:** `src/app/api/sponsor/route.ts:188-190`
**Status:** Open — fix applied

**Description:**

The `sender` field is validated only for presence and string type:

```ts
if (!sender || typeof sender !== 'string') {
  return NextResponse.json({ error: 'Missing or invalid sender address' }, { status: 400 });
}
```

No validation confirms the value is a well-formed Sui address (a `0x`-prefixed, 64-hex-character string). The raw, unvalidated value is subsequently passed directly to `tx.setSenderIfNotSet(sender)` and used as the rate-limit key.

**Consequences:**

1. **Rate-limit key pollution:** An attacker can submit `sender: "x"` (or any short string) and consume a rate-limit bucket under a key that legitimate wallets will never collide with. By cycling through thousands of syntactically-invalid "addresses," an attacker inflates `rateLimitStore` with entries that real wallets will never occupy.

2. **Downstream SDK behavior:** `Transaction.setSenderIfNotSet()` accepts any string. If the Move runtime rejects a malformed address during on-chain execution, the transaction fails after the sponsor has signed and the gas coin reference has been consumed.

3. **Log injection risk:** The raw `sender` value may appear in server-side logs. A crafted string could confuse log aggregators that do not sanitize input.

**Fix applied:** Regex validation added before any further processing:

```ts
const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;
if (!SUI_ADDRESS_RE.test(sender)) {
  return NextResponse.json({ error: 'Invalid sender address format' }, { status: 400 });
}
```

---

### SEC-02 — `txKindBytes` Payload Size Not Bounded

**Severity:** High
**File:** `src/app/api/sponsor/route.ts:185-186, 229-232`
**Status:** Open — fix applied

**Description:**

The `txKindBytes` field is accepted as an arbitrary-length base64 string with no maximum size check. The route then decodes and fully deserializes the bytes:

```ts
tx = Transaction.fromKind(Buffer.from(txKindBytes, 'base64'));
```

**Consequences:**

1. **Memory exhaustion (OOM):** Decoding and deserializing a megabyte-scale payload allocates memory proportional to input size. Serverless functions on Vercel have a 512 MB–1 GB memory limit; a sufficiently large payload forces an OOM kill, restarting the process and clearing the in-memory rate-limit store.

2. **CPU exhaustion:** BCS deserialization is CPU-bound. A stream of large-payload requests is an effective CPU denial-of-service.

3. **Rate-limit bypass via OOM restart:** Each process restart clears `rateLimitStore`, allowing previously rate-limited senders to resume from zero.

A legitimate Sui PTB with seven Move calls is well under 10 KB of BCS bytes, which base64-encodes to approximately 13.4 KB.

**Fix applied:**

```ts
const MAX_TX_KIND_BYTES_BASE64_LEN = 16_384; // 16 KB; real PTBs are well under 2 KB
if (txKindBytes.length > MAX_TX_KIND_BYTES_BASE64_LEN) {
  return NextResponse.json({ error: 'txKindBytes exceeds maximum allowed size' }, { status: 400 });
}
```

---

### SEC-03 — In-Memory Rate-Limit Store Grows Without Bound

**Severity:** High
**File:** `src/app/api/sponsor/route.ts:74, 88-103`
**Status:** Open — fix applied

**Description:**

`rateLimitStore` is a module-level `Map` appended to for every unique rate-limit key but **never pruned**. Entries are logically expired when `Date.now() > entry.resetAt`, but expired entries persist in memory until process restart.

The `checkRateLimit` function overwrites stale entries only when the same key is seen again. An attacker who submits one request per unique IP or Sui address per 24-hour window causes the store to grow by two entries per unique key per day. At 1 million unique addresses × 2 entries = 2 million Map entries. Each `RateLimitEntry` object plus V8 Map overhead is roughly 200 bytes, totalling approximately 400 MB — enough to OOM a serverless function and reset the rate-limit state.

**Fix applied:** A lazy eviction sweep that runs every 500 requests removes expired entries:

```ts
let sweepCounter = 0;
const SWEEP_INTERVAL = 500;

function maybeSweepExpiredEntries(): void {
  if (++sweepCounter % SWEEP_INTERVAL !== 0) return;
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}
```

The production fix remains Redis (existing TODO). This prevents OOM on the current in-memory implementation.

---

### SEC-04 — Rate-Limit Counter Incremented Before Transaction Validation

**Severity:** Medium
**File:** `src/app/api/sponsor/route.ts:208-242`
**Status:** Open — fix applied

**Description:**

Rate-limit counters for both sender and IP are incremented **before** the transaction bytes are deserialized or validated (deserialization occurs at line 229, validation at line 236, but rate-limiting fires at lines 208-223). A legitimate user whose client consistently produces invalid `txKindBytes` (e.g., due to a serialization bug) burns one slot of their 50-transaction daily quota per failed attempt.

Additionally, the rollback logic that decrements `entry.count` when the IP check fires (lines 217-218) is not atomic with respect to concurrent requests in a serverless environment. Two simultaneous requests from the same sender can both pass the sender check before either rollback executes, causing the counter to drift above `RATE_LIMIT_MAX`.

**Fix applied:** Rate-limit enforcement moved to after deserialization and validation succeed, immediately before the signing step. Quota is consumed only for requests that would have been signed.

---

### SEC-05 — `SPONSOR_PRIVATE_KEY` Schema Validates Presence Only

**Severity:** Medium
**File:** `src/env.ts:15`
**Status:** Open — fix applied

**Description:**

```ts
SPONSOR_PRIVATE_KEY: z.string().min(1),
```

The Zod schema requires only that the string is at least 1 character. It does not validate the bech32 format (`suiprivkey1...`) required by `@mysten/sui` v2+. If an operator copies a legacy base64 key instead of a bech32 key, env validation passes at build time but `Ed25519Keypair.fromSecretKey()` throws at request time, returning HTTP 503 to all users until corrected.

**Fix applied:**

```ts
SPONSOR_PRIVATE_KEY: z
  .string()
  .min(1)
  .refine(
    (val) => val.startsWith('suiprivkey1'),
    { message: 'SPONSOR_PRIVATE_KEY must be a bech32-encoded Ed25519 key (starts with "suiprivkey1")' }
  ),
```

This catches format mismatches at startup rather than at first request.

---

### SEC-06 — CSP Uses `unsafe-eval` in Production Builds

**Severity:** Medium
**File:** `next.config.ts:22-23`
**Status:** Open — fix applied

**Description:**

```ts
"script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
```

The comment acknowledges that `unsafe-eval` is required only in development (for hot module replacement), but the same directive is applied unconditionally in production builds. `unsafe-eval` permits runtime code evaluation — the primary mechanism by which XSS payloads escalate from content injection to script execution. Together with `unsafe-inline`, the CSP provides no meaningful XSS protection in production despite being present.

**OWASP mapping:** A03:2021 — Injection (XSS via CSP bypass).

**Fix applied:** CSP `script-src` is now split by `NODE_ENV`:

```ts
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline'";
```

Removing `unsafe-inline` entirely (via a nonce-based approach using Next.js middleware) is tracked as a follow-up improvement.

---

### SEC-07 — IP Source Trusted Without Proxy Validation

**Severity:** Medium
**File:** `src/app/api/sponsor/route.ts:203-206`
**Status:** Open — documentation only

**Description:**

```ts
const ip =
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'unknown';
```

The `x-forwarded-for` header is set by proxies and load balancers but can also be forged by any HTTP client that reaches the Next.js server directly. If the server is deployed without an upstream proxy that strips or overwrites XFF (which Vercel's CDN does correctly), an attacker can set an arbitrary IP in the header and bypass the IP-based rate limit by cycling through IP addresses.

The fallback value `'unknown'` collapses all requests without a detectable IP into one rate-limit bucket, meaning a single attacker behind a CDN that strips XFF can exhaust the quota of all similarly-situated legitimate users.

**Recommendation (not auto-applied — requires infrastructure knowledge):**

- Document that the deployment target must overwrite `x-forwarded-for` before it reaches the application (Vercel does this; other platforms may not).
- Consider using Vercel's `x-vercel-forwarded-for` header (which Vercel controls and clients cannot spoof) when deployed on Vercel, via a runtime check on `process.env.VERCEL`.
- Replace the `'unknown'` fallback with a fixed key (e.g., `'no-ip'`) so all requests without a detectable IP share one rate-limit bucket that is separately monitored.

---

### SEC-08 — `listCoins` Fetches Only One Gas Coin

**Severity:** Medium
**File:** `src/app/api/sponsor/route.ts:269-278`
**Status:** Open — fix applied

**Description:**

```ts
const gasCoins = await suiClient.listCoins({
  owner: sponsorAddress,
  limit: 1,
});
```

Only one SUI coin is fetched for gas payment. If that coin's balance is less than the gas budget (0.01 SUI = 10,000,000 MIST), the transaction fails on-chain after the sponsor has signed. The Sui protocol allows multiple coins to be merged into a single gas payment via `setGasPayment`, but this capability is unused.

A sponsor wallet that has been split into many small coins (a common state after many sponsored transactions) will fail to sponsor even when its total SUI balance is sufficient. This failure occurs on-chain, is opaque to the user, and is difficult to diagnose.

**Fix applied:** Increased the coin fetch limit to 10 so the gas payment can span multiple coins:

```ts
const gasCoins = await suiClient.listCoins({
  owner: sponsorAddress,
  limit: 10,
});
```

---

### SEC-09 — Stale JSDoc in `transactions.ts` Describes Old Redemption Behavior

**Severity:** Low
**File:** `src/lib/transactions.ts:129-130`
**Status:** Open — fix applied

**Description:**

The JSDoc for `buildRedeem` states:

```
Resets current_stamps to 0 and increments total_earned.
```

This was accurate before FIND-06 was remediated. The current Move contract (`suiki.move:220-222`) carries excess stamps forward rather than resetting to zero. The stale comment will mislead developers who rely on it during future refactoring of the redemption flow and could cause incorrect unit test assumptions.

**Fix applied:** JSDoc updated to reflect carry-forward behavior.

---

### SEC-10 — `TARGETS` Map Missing Two Allowlisted Functions

**Severity:** Low
**File:** `src/lib/constants.ts:29-35`
**Status:** Open — fix applied

**Description:**

`ALLOWED_FUNCTIONS` in `route.ts` permits seven functions: `create_program`, `create_card_and_stamp`, `issue_stamp`, `redeem`, `update_program`, `sync_card_metadata`, and `transfer_merchant`. The `TARGETS` constant in `constants.ts` defines only five — `sync_card_metadata` and `transfer_merchant` are absent.

Any client code that wants to invoke these functions must construct the target string manually (concatenating `PACKAGE_ID`, module name, and function name), bypassing the centralized constants. If `PACKAGE_ID` is ever updated, manually-constructed strings will not be caught by a search for `TARGETS.`.

**Fix applied:** Added `syncCardMetadata` and `transferMerchant` to `TARGETS`.

---

### SEC-11 — No `OPTIONS` / CORS Handler on Sponsor Endpoint

**Severity:** Low
**File:** `src/app/api/sponsor/route.ts` (absent)
**Status:** Open — documentation only

**Description:**

The route exports only a `POST` handler. Browsers sending cross-origin `POST` requests with `Content-Type: application/json` first send a CORS preflight (`OPTIONS` request). Without an explicit `OPTIONS` handler, Next.js App Router returns a 405. Depending on the browser and CDN behavior, this can cause the preflight to be cached as failed, blocking subsequent legitimate cross-origin requests.

In the current same-origin deployment this is not exploitable. It becomes a functional issue if the front-end and API ever diverge onto different origins (e.g., a mobile app, a partner integration, or a separate staging domain).

**Recommendation:** Add an `OPTIONS` export that returns appropriate CORS headers restricted to the known application origin. See recommended fix in SEC-01 fix block for reference implementation.

---

### SEC-12 — Gas Budget Hard-Coded; No Maximum PTB Command Count

**Severity:** Low
**File:** `src/app/api/sponsor/route.ts:285`
**Status:** Open — fix applied (command count limit only)

**Description:**

The gas budget is fixed at 10,000,000 MIST (0.01 SUI). For a single-call PTB this is sufficient under current pricing. However:

1. The allowlist permits PTBs with multiple valid commands. A PTB with ten `issue_stamp` calls is valid but may exceed the budget under network congestion or future gas price changes.
2. No maximum command count is enforced on the PTB. A PTB with hundreds of allowlisted calls is theoretically acceptable to the validator but would consume excessive gas and cause on-chain failure after the sponsor has signed.

**Fix applied:** Maximum command count check added to `validateAllCommands`:

```ts
const MAX_COMMANDS = 10;
if (data.commands.length > MAX_COMMANDS) {
  return { valid: false, reason: `Too many commands: ${data.commands.length} (max ${MAX_COMMANDS})` };
}
```

Dynamically querying `suiClient.getReferenceGasPrice()` to set the budget proportionally is recommended as a follow-up.

---

### SEC-13 — `asSuiAddress` Performs No Runtime Validation

**Severity:** Low
**File:** `src/types/sui.ts:19`
**Status:** Open — documentation only

**Description:**

```ts
export const asSuiAddress = (value: string): SuiAddress => value as SuiAddress;
```

This helper is a TypeScript-only cast with no runtime check. Its name implies validation; developers who call it expecting sanitization will be surprised. The branded type provides compile-time differentiation but accepts any string value at runtime.

In the current codebase the only call site is `asSuiAddress(account.address)` in `use-sponsored-tx.ts:82`, where `account.address` is always a valid address from the wallet SDK. The risk is future call sites that pass unvalidated user input.

**Recommendation:** Rename to `castAsSuiAddress` to signal the cast-only semantics, or add a runtime guard consistent with the SEC-01 fix.

---

## Summary Table

| ID | File | Severity | Title | Fixed |
|---|---|---|---|---|
| SEC-01 | route.ts:188 | High | Sender address accepted without format validation | Yes |
| SEC-02 | route.ts:185 | High | `txKindBytes` payload size not bounded | Yes |
| SEC-03 | route.ts:74 | High | In-memory rate-limit store grows without bound | Yes |
| SEC-04 | route.ts:208 | Medium | Rate-limit counter incremented before validation | Yes |
| SEC-05 | env.ts:15 | Medium | `SPONSOR_PRIVATE_KEY` schema validates presence only | Yes |
| SEC-06 | next.config.ts:22 | Medium | CSP uses `unsafe-eval` in production | Yes |
| SEC-07 | route.ts:203 | Medium | IP source trusted without proxy validation | No (doc) |
| SEC-08 | route.ts:269 | Medium | `listCoins` fetches only one gas coin | Yes |
| SEC-09 | transactions.ts:129 | Low | Stale JSDoc describes old `redeem` behavior | Yes |
| SEC-10 | constants.ts:29 | Low | `TARGETS` map missing `sync_card_metadata` and `transfer_merchant` | Yes |
| SEC-11 | route.ts (absent) | Low | No `OPTIONS`/CORS handler on sponsor endpoint | No (doc) |
| SEC-12 | route.ts:285 | Low | Gas budget hard-coded; no maximum command count | Yes |
| SEC-13 | types/sui.ts:19 | Low | `asSuiAddress` performs no runtime validation | No (doc) |

**Severity breakdown:** 0 Critical, 3 High, 5 Medium, 5 Low

---

## OWASP Top 10 Mapping

| OWASP Category | Finding(s) |
|---|---|
| A01 — Broken Access Control | SEC-07 (IP spoofing bypasses rate limit) |
| A02 — Cryptographic Failures | SEC-05 (weak key format validation) |
| A03 — Injection | SEC-06 (CSP `unsafe-eval`/`unsafe-inline` weakens XSS defense in production) |
| A04 — Insecure Design | SEC-04 (quota burned before validation), SEC-08 (single coin gas failure), SEC-12 (no command count cap) |
| A05 — Security Misconfiguration | SEC-06 (CSP), SEC-11 (missing CORS preflight handler) |
| A06 — Vulnerable Components | None identified |
| A07 — Identification & Auth Failures | SEC-01 (unvalidated sender used as rate-limit key), SEC-03 (rate-limit OOM resets auth state) |
| A08 — Software Integrity Failures | SEC-10 (TARGETS/allowlist mismatch creates maintenance integrity risk) |
| A09 — Logging & Monitoring Failures | SEC-07 (`'unknown'` IP fallback collapses traffic, masking attacker patterns) |
| A10 — SSRF | Not applicable (no server-side URL fetch from user-supplied input) |

---

## What the Implementation Does Well

- **PTB allowlist enforcement is correct and complete.** Every command in every PTB is validated against a strict `(package, module, function)` triple before signing. Non-MoveCall commands are explicitly rejected. This is the most critical control and it is correctly implemented.
- **Key is never logged or returned.** The sponsor private key is loaded only at signing time. All error paths return generic messages. No stack traces or key material appear in HTTP responses.
- **`SPONSOR_PRIVATE_KEY` is server-only.** The variable has no `NEXT_PUBLIC_` prefix and is correctly scoped under the `server:` block in `env.ts`, which @t3-oss/env-nextjs will refuse to expose to the client bundle.
- **`emptyStringAsUndefined: true` in `env.ts`.** Prevents blank environment variables from passing validation as empty strings, which is a frequent misconfiguration vector.
- **Security headers in `next.config.ts`.** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` are all correctly set. The `connect-src` CSP directive allowlists only the known Sui fullnode URLs, preventing data exfiltration to arbitrary endpoints.
- **Branded types for addresses and object IDs.** The `SuiAddress` and `SuiObjectId` branded types prevent argument-order confusion at compile time.
- **Move access control is purely capability-based.** Every state-mutating Move function checks `ctx.sender()` against the stored merchant or customer address. There is no privileged admin key in the contract; control is object-capability-based and cannot be bypassed by any off-chain actor.

---

*Audit date: 2026-03-26*
*Auditor: Claude Sonnet 4.6 (AI Security Review — not a substitute for a professional smart contract audit)*
*Recommendation: Engage a professional Move auditor (OtterSec, Zellic, or equivalent) before mainnet deployment. Priority items for human review: PTB deserialization/validation logic (SEC-01 through SEC-04) and the in-memory rate-limiter Redis migration.*
