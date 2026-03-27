---
title: "Suiki — Security Requirements: Tasks 5–7"
date: 2026-03-25
status: active
scope: "Task 5 (Wallet Integration), Task 6 (Sponsor API), Task 7 (Transaction Hooks)"
tags:
  - project/suiki
  - security/requirements
  - blockchain/sui
  - type/security-requirements
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — Security Requirements: Tasks 5–7

> **Purpose:** Prescriptive security requirements for the three implementation tasks covering the wallet integration layer, gas sponsor API, and sponsored transaction hooks. Each requirement states the severity of the risk it addresses, what must be implemented, and what must be avoided. Implementation code is out of scope for this document.

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Immediate, irreversible fund loss or full system compromise if violated |
| **High** | Significant harm — wallet drain, fake sponsorship, key exposure |
| **Medium** | Degrades integrity or UX in ways that are hard to undo |
| **Low** | Minor operational risk or best-practice gap |

---

## 1. Sponsor API (Task 6) — `POST /api/sponsor`

The sponsor API is the highest-value attack target in the system. A successful exploit drains the sponsor wallet and can sponsor arbitrary on-chain activity. Every requirement in this section must be satisfied before the route is accessible from a public URL.

---

### SR-601 — Private Key Storage

**Severity: Critical**

**What to implement:**
- Store `SPONSOR_PRIVATE_KEY` exclusively as a server-side environment variable — never prefixed with `NEXT_PUBLIC_`.
- Access it only via `process.env.SPONSOR_PRIVATE_KEY` inside an API route or Server Component. The `src/env.ts` schema already enforces this via `@t3-oss/env-nextjs`'s `server` block — this boundary must not be broken.
- Scope the variable to the Production environment in Vercel. Do not inject it into Preview or Development deployments.
- Validate at startup that the key is present and parseable. The route already does this with an early return on missing or unparseable key — preserve this guard.
- Keep the sponsor wallet balance low (operational float only). Fund it via a cold wallet with automated top-up, not a lump-sum deposit. Maximum loss on key compromise is bounded by the hot wallet balance.
- Plan migration to a KMS (AWS KMS, Google Cloud KMS, or a hardware wallet via a custom `Signer` interface) before mainnet. A raw base64 key string in an environment variable is acceptable for testnet and controlled beta; it is not acceptable for production SUI mainnet.

**What to avoid:**
- Never add `NEXT_PUBLIC_` to `SPONSOR_PRIVATE_KEY`. This would embed the key in every client bundle sent to every browser.
- Never log the private key, the full keypair object, or any error that could serialise the keypair as a side effect (e.g., `console.error(sponsorKeypair)` or `console.log(ctx)`).
- Never store the key in a `.env.local` file that is committed to the repository. Confirm `.env.local` and `.env.production.local` are in `.gitignore`.
- Never pass the key through the client: the signing must happen entirely server-side. The API returns `transactionBytes` and `sponsorSignature` — not the key material that produced them.
- Never allow preview deployments to share the production key. Use a separate low-funded testnet key for preview environments, or disable the endpoint in non-production environments.

---

### SR-602 — Rate Limiting

**Severity: High**

**What to implement:**
- Enforce two independent rate-limit counters per request: one keyed on the sender's SUI address, one keyed on the originating IP address. The current in-memory implementation in `route.ts` does this correctly.
- Set a 24-hour window limit of 50 sponsored transactions per sender address and 50 per IP address (configurable via a constant, not hardcoded in logic).
- Before mainnet: replace the in-memory `Map`-based rate limiter with a persistent, distributed store — Upstash Redis with a sliding window algorithm is the recommended approach for Vercel deployments. The in-memory store is per-process and does not survive restarts or scale across multiple serverless instances.
- Add a global daily cap on total sponsored transactions across all senders (a circuit-breaker), configurable via an environment variable. If the global cap is reached, the endpoint returns 429 regardless of per-sender or per-IP status.
- Return a `Retry-After` header with the 429 response indicating when the window resets.
- Consider requiring on-chain proof of merchant identity before sponsoring `create_program` or `create_card_and_stamp`: the sender must already own at least one `StampProgram` object (queryable via SUI RPC) to raise the cost of Sybil attacks.

**What to avoid:**
- Do not rate-limit on sender address alone. A new SUI address costs nothing to generate — a sender-only limit provides no protection against address proliferation attacks (see FIND-02 in `Security Audit.md`).
- Do not silently swallow rate-limit state inconsistencies. The current implementation has a rollback on the sender counter when the IP check fails — preserve this rollback logic.
- Do not expose rate-limit counters or window reset timestamps in error body detail beyond the `Retry-After` header. Exposing exact counter values helps attackers calibrate their request timing.

---

### SR-603 — PTB Validation: Allowlist All Commands

**Severity: Critical**

**What to implement:**
- Deserialise `txKindBytes` using `Transaction.from()` before signing. Do not sign bytes that have not been parsed.
- Validate every command in the PTB, not just the first one. The current `validateAllCommands` function in `route.ts` already does this — it must not be weakened.
- Enforce all four of these checks on every command in the PTB:
  1. The command kind must be `MoveCall`. Reject `TransferObjects`, `SplitCoins`, `MergeCoins`, `Publish`, `Upgrade`, and all other command types.
  2. The package address in the MoveCall must exactly match `NEXT_PUBLIC_PACKAGE_ID`. String prefix matching is not sufficient — use strict equality on the full address.
  3. The module name must be the exact `suiki` module name string (from `MODULE_NAME` constant).
  4. The function name must be a member of an explicit allowlist (the `ALLOWED_FUNCTIONS` Set in `route.ts`). The allowlist must be a closed set — adding new contract functions does not automatically sponsor them until they are explicitly added to the allowlist.
- The allowlist must be kept synchronised with the deployed Move contract. Document the allowlist alongside the contract's public functions so they are reviewed together at each deployment.
- Log the validation rejection reason at `warn` level (not `error`) with the sender address and the offending command, to support incident investigation without over-alerting.

**What to avoid:**
- Do not sign a PTB if any single command fails validation. One invalid command in a multi-command PTB must reject the entire PTB, not just skip the offending command (see FIND-16 in `Security Audit.md`).
- Do not use prefix matching on the module path (e.g., checking that the target "starts with" the package ID). An attacker can deploy a contract at an address that matches a prefix. Use strict string equality.
- Do not skip deserialization and attempt to validate `txKindBytes` as a raw string via regex. Only a fully parsed `Transaction` object provides trustworthy command enumeration.
- Do not allow `Publish` or `Upgrade` commands under any circumstances. These commands deploy or modify contracts and must never be sponsored.

---

### SR-604 — Input Sanitisation on `txKindBytes`

**Severity: High**

**What to implement:**
- Validate that `txKindBytes` is a non-empty string before passing it to `Transaction.from()`. The current handler does this.
- Wrap `Transaction.from()` in a try/catch and return 400 on parse failure. Malformed bytes must not propagate to the signing path.
- Validate that `sender` is a structurally valid SUI address: 0x-prefixed, 64 hex characters after the prefix (or the standard SUI address format). Reject requests where `sender` does not match this format before the rate-limit check, to avoid polluting the rate-limit store with garbage keys.
- Enforce a maximum byte length on `txKindBytes` to prevent denial-of-service via oversized payloads. A reasonable upper bound for a single-command PTB is 10 KB; reject anything larger.
- Validate the `Content-Type` header is `application/json`. Reject requests with unexpected content types at the earliest possible point.

**What to avoid:**
- Do not attempt to sanitize `txKindBytes` as a string (strip characters, encode, etc.). The bytes are a binary serialisation format. The only valid sanitisation is: parse it as a `Transaction` and inspect the resulting object model. Anything else gives false confidence.
- Do not reflect the raw `txKindBytes` value back in any error response. Even a truncated echo could leak information about the payload structure.
- Do not log `txKindBytes` at any level. These bytes represent a user-crafted transaction and may contain sensitive object IDs or input values.

---

### SR-605 — Sponsor Signature Must Not Be Logged

**Severity: High**

**What to implement:**
- The `sponsorSignature` returned in the response is a cryptographic signature produced by the sponsor's private key. It must only travel in the JSON response body, over HTTPS.
- Structured log entries in the success path must include only: a request ID, the sender address, the list of validated function names called, and the HTTP status. They must not include the `sponsorSignature` or `transactionBytes`.
- If an error occurs after signing (e.g., network failure returning the response), log the error message and request ID only — not the signature that was already computed.

**What to avoid:**
- Do not log `sponsorSignature` at any level, including `debug`. Once the signature is in a log, it is permanently accessible to anyone with log access and is functionally equivalent to publishing a pre-signed transaction.
- Do not include `sponsorSignature` in error responses. Error responses go to the client, not the requester that should execute the transaction, and correlation of signatures with error contexts could assist timing attacks.

---

## 2. Wallet Integration (Task 5)

Task 5 integrates the SUI dApp Kit (`@mysten/dapp-kit-react`) for wallet connection. The wallet integration surface is entirely client-side and the primary risks are bundle contamination, logging of sensitive addresses, and improper rendering context for wallet components.

---

### SR-501 — No Private Keys in the Frontend

**Severity: Critical**

**What to implement:**
- All wallet operations — signing, key derivation, account enumeration — must go through the wallet adapter provided by `DAppKitProvider`. The application code must never hold, generate, or store a private key.
- The `Providers` component (`src/app/providers.tsx`) correctly sets up `DAppKitProvider` with `"use client"` at the top of the file. This boundary must be preserved.
- The sponsor wallet's `SPONSOR_PRIVATE_KEY` is only used in `src/app/api/sponsor/route.ts` (a server route). This separation must never be collapsed — the sponsor key must never be imported into any file in `src/components/`, `src/hooks/`, or any other client-side path.
- Perform a bundle audit before each production deploy: use `next build --analyze` (or `@next/bundle-analyzer`) and verify `SPONSOR_PRIVATE_KEY` does not appear in any chunk. Consider adding a CI step that searches the `.next/static/` directory for the pattern `SPONSOR_PRIVATE_KEY`.

**What to avoid:**
- Never import `Ed25519Keypair` or any keypair utility from `@mysten/sui` in client components. These classes are appropriate in server routes only.
- Never create a "development convenience" where a hardcoded sponsor key is used client-side to avoid needing the API route locally. Even test keys must not appear in client bundles.
- Never store wallet connection state (addresses, public keys) in `localStorage` directly. The dApp Kit manages connection persistence. Application code writing to `localStorage` risks XSS exfiltration.

---

### SR-502 — ConnectButton Must Be Client-Side Only

**Severity: High**

**What to implement:**
- Any component that renders a wallet connect button or that calls `useCurrentAccount()`, `useConnectWallet()`, or any other dApp Kit hook must be a Client Component (`"use client"` directive at the top of the file, or inside a subtree wrapped by a Client Component boundary).
- The `Providers` component already has `"use client"` and wraps `DAppKitProvider`. All wallet UI components must be rendered inside this provider tree.
- Use dynamic imports with `ssr: false` for any component that renders wallet state, to prevent server-side rendering of wallet-dependent UI that would throw a hydration mismatch or attempt to access browser APIs during SSR.

**What to avoid:**
- Do not attempt to render a wallet connect button in a Server Component. Server Components cannot access browser APIs or React context, and the dApp Kit's context providers rely on both.
- Do not call dApp Kit hooks outside the `DAppKitProvider` tree. This will throw a React context error at runtime.
- Do not conditionally add `"use client"` based on an environment check. The directive must be unconditional — it is a compile-time boundary signal to the Next.js bundler, not a runtime flag.

---

### SR-503 — Never Log Wallet Addresses

**Severity: Medium**

**What to implement:**
- Wallet addresses (`SuiAddress` branded type) may constitute personal data under the Philippines Data Privacy Act (see FIND-15 in `Security Audit.md`). Treat them with the same care as any personally identifying field.
- Where logging of blockchain activity is necessary for debugging (e.g., transaction submission), truncate the address to the first 10 and last 4 characters for display: `0x1234...abcd`. Never log the full address.
- In error messages surfaced to the user interface, show a truncated address or the label "your wallet" rather than the full hex string.
- Apply the same rule to `merchant` and `customer` address fields from on-chain objects (`StampProgram.merchant`, `StampCard.customer`).

**What to avoid:**
- Do not use `console.log(account)` or `console.log(walletAddress)` in production code paths. Even if the address is pseudonymous, logging it to browser console creates a persistent, accessible record.
- Do not include raw wallet addresses in client-side error reports sent to a third-party analytics service (Sentry, Datadog) without first pseudonymising them.
- Do not store the connected wallet address in a cookie or `localStorage` key with a predictable name, as this makes it trivially readable by any XSS payload.

---

## 3. Transaction Hooks (Task 7)

Task 7 implements the `use-sponsored-tx` hook (and related hooks) that call `/api/sponsor`, then counter-sign with the user's wallet and submit the transaction. The hook is the bridge between the untrusted server response and the user's signing action — it is the last line of defence before a transaction executes.

---

### SR-701 — Validate Server Response Before Executing

**Severity: Critical**

**What to implement:**
- After receiving a response from `POST /api/sponsor`, the hook must validate the structure of the response before passing anything to the wallet's `signAndExecuteTransaction` method.
- At minimum, validate:
  - The HTTP status is 200. Non-200 responses must surface an error state, not silently fall through.
  - The response body is a valid JSON object.
  - `transactionBytes` is a non-empty string.
  - `sponsorSignature` is a non-empty string.
  - The `transactionBytes` can be deserialized by the SUI SDK into a valid `Transaction` object. If deserialization fails, abort — do not pass malformed bytes to the wallet.
- Display a human-readable error to the user when any of these checks fail. Do not silently retry or swallow errors.
- The type system already defines `SponsoredTxResponse` and `SponsoredTxErrorResponse` in `src/types/sui.ts`. Use these types with runtime validation (Zod schema or equivalent) rather than relying on TypeScript alone, which provides compile-time safety only.

**What to avoid:**
- Do not assume a 200 response contains valid `transactionBytes`. Network intermediaries, CDN edge caches, or misconfigured proxies can return 200 with an error body.
- Do not pass `sponsorSignature` to `signAndExecuteTransaction` without first checking that `transactionBytes` parsed successfully. Passing a signature with incompatible bytes will produce a confusing on-chain error.
- Do not catch and suppress errors from the sponsor API call. Each error type (network failure, rate limit, validation rejection, server error) requires a distinct user-facing message.

---

### SR-702 — Never Expose Sponsor Signature to Logs

**Severity: High**

**What to implement:**
- The `sponsorSignature` returned by `/api/sponsor` is a live cryptographic signature. Once it is counter-signed by the user and submitted, it becomes public on-chain — but until that point it must be treated as sensitive.
- Inside the hook, hold `sponsorSignature` only in a local variable within the async function scope. Do not store it in React state, `useRef`, a global variable, or any persistent store.
- Pass `sponsorSignature` directly to `signAndExecuteTransaction` and allow it to go out of scope immediately after submission.
- In error handlers, log the error message and a transaction reference (e.g., a digest if available) — not the signature itself.

**What to avoid:**
- Do not log `sponsorSignature` to the browser console at any level, including `debug` or development-only code paths. A developer toolbar, browser extension, or XSS payload can read console output.
- Do not persist `sponsorSignature` to `localStorage`, `sessionStorage`, or a React context value. If the user navigates away before submitting, the signature must be discarded, not persisted for reuse.
- Do not include `sponsorSignature` in error reports sent to Sentry or any third-party observability service.

---

### SR-703 — Handle Failed Transactions Gracefully

**Severity: Medium**

**What to implement:**
- Distinguish between these distinct failure modes, each requiring a different UX response:
  1. **Network failure reaching `/api/sponsor`** — transient; display "Unable to reach the sponsorship service. Please try again."
  2. **Rate limit (429)** — deterministic; display the Retry-After time and advise the user to wait.
  3. **Validation rejection (403)** — the transaction was rejected by the sponsor because it did not meet the allowlist criteria. This should never occur if the client-side transaction builders in `src/lib/transactions.ts` are used correctly. If it occurs, display a generic "Transaction not supported" message and log the full error server-side for investigation.
  4. **Sponsor keypair misconfiguration (503)** — server-side; display "Service temporarily unavailable."
  5. **User rejected wallet signing** — the user declined in their wallet app. Display "Transaction cancelled."
  6. **On-chain execution failure** — the transaction was submitted but the Move contract aborted (e.g., `ENotMerchant`, `ENotEnoughStamps`). Parse the abort code and display a specific message (e.g., "You do not have enough stamps to redeem yet.").
- Provide a retry affordance for transient failures (cases 1, 4). Do not auto-retry silently — let the user initiate the retry.
- After a failed submission, reset the hook's state so the user can attempt the transaction again without refreshing the page.

**What to avoid:**
- Do not expose raw Move abort codes, error stack traces, or internal error messages directly in the UI. These leak implementation details and are unhelpful to end users.
- Do not automatically retry a transaction that was rejected by the sponsor validator (403). Retrying a rejected PTB will always produce the same result and wastes rate-limit quota.
- Do not leave the UI in a loading/spinner state after a failure. Every failure path must resolve to a visible error state with a recovery action.
- Do not swallow `useSignAndExecuteTransaction` errors with an empty catch block. Uncaught promise rejections from wallet operations produce silent failures that are extremely difficult to debug.

---

## 4. Environment Variables

---

### SR-401 — `SPONSOR_PRIVATE_KEY` Must Only Exist in Server Context

**Severity: Critical**

**What to implement:**
- `SPONSOR_PRIVATE_KEY` is declared in the `server` block of `src/env.ts` using `@t3-oss/env-nextjs`. This schema enforces that the variable is never accessible in client-side code at the framework level.
- Add a CI check that scans the compiled client bundle (`.next/static/chunks/`) for the literal string `SPONSOR_PRIVATE_KEY` and fails the build if found.
- In Vercel project settings: set the variable's Environment scope to "Production" only. For Preview and Development environments, either omit the variable entirely (the API route will return 503, which is acceptable for non-production) or populate it with a separate, low-funded testnet keypair.
- In local development: populate `SPONSOR_PRIVATE_KEY` in `.env.local` with a devnet keypair that holds only a small amount of devnet SUI. Never use a mainnet key locally.

**What to avoid:**
- Never prefix this variable with `NEXT_PUBLIC_`. The `@t3-oss/env-nextjs` library will throw at build time if a server variable is accessed from a client context, but the `NEXT_PUBLIC_` prefix would bypass this protection entirely by placing the value in the client bundle.
- Never read `SPONSOR_PRIVATE_KEY` from `env` (the validated client-safe `env` object exported from `src/env.ts`) inside a client component. The `env.ts` schema already prevents this — do not attempt to work around it.
- Never commit a `.env` or `.env.local` file that contains a real private key to the repository, even a testnet key.

---

### SR-402 — `NEXT_PUBLIC_*` Variables Are Safe to Expose

**Severity: Low (informational)**

**What to implement:**
- `NEXT_PUBLIC_SUI_NETWORK` and `NEXT_PUBLIC_PACKAGE_ID` are intentionally client-safe. They are deployed contract addresses and network identifiers — public information by design on a transparent blockchain.
- Validate both at startup via the `client` block in `src/env.ts` (already implemented). This ensures the app fails loudly at build time if these are missing, rather than silently rendering broken UI.
- Treat `NEXT_PUBLIC_PACKAGE_ID` as the source of truth for all Move call target construction. The `TARGETS` and `EVENT_TYPES` constants in `src/lib/constants.ts` derive from this value — do not hardcode the package ID anywhere else.

**What to avoid:**
- Do not treat `NEXT_PUBLIC_*` variables as confidential. They are embedded in the client bundle and visible to anyone who inspects the page source. Do not put API keys, secrets, or credentials in `NEXT_PUBLIC_*` variables under any circumstances.
- Do not set `skipValidation: true` unconditionally. Setting it unconditionally would allow the app to boot with missing or invalid environment variables, masking misconfiguration errors. The current implementation correctly gates it on `SKIP_ENV_VALIDATION=true`.

---

## 5. Content Security Policy

A SUI dApp PWA has a specific set of external origins it must communicate with at runtime. A Content Security Policy enforces these to a minimum set, reducing the blast radius of any XSS attack.

---

### SR-501-CSP — Required Headers for a SUI dApp PWA

**Severity: High**

**What to implement:**

Set the following response headers via `next.config.ts` headers configuration (applied to all routes):

**`Content-Security-Policy`**

The policy must include these directives, minimum:

| Directive | Required values | Rationale |
|---|---|---|
| `default-src` | `'self'` | Deny all by default |
| `script-src` | `'self'` `'unsafe-eval'` (dev only) | Next.js requires `unsafe-eval` in development for HMR; remove from production |
| `connect-src` | `'self'` `https://*.sui.io` `https://*.mysten.io` `wss://*.sui.io` | SUI fullnode RPC (JSON-RPC and gRPC-Web/WebSocket), dApp Kit internals |
| `img-src` | `'self'` `data:` `https:` | Merchant logo URLs are arbitrary HTTPS URLs from on-chain; restrict to HTTPS scheme only |
| `style-src` | `'self'` `'unsafe-inline'` | Next.js inlines critical CSS; inline styles are unavoidable without CSS-in-JS hashing |
| `font-src` | `'self'` `https://fonts.gstatic.com` | Google Fonts (Geist) are loaded from `fonts.gstatic.com` per `layout.tsx` |
| `frame-src` | `'none'` | The app has no iframes; denying frame embedding prevents clickjacking |
| `frame-ancestors` | `'none'` | Prevent this app from being embedded in another page (clickjacking) |
| `object-src` | `'none'` | No Flash or plugin content |
| `base-uri` | `'self'` | Prevent base tag injection |
| `form-action` | `'self'` | Prevent form hijacking to external origins |
| `upgrade-insecure-requests` | (flag directive) | Force all requests to HTTPS in production |

**`X-Frame-Options`**
- Set to `DENY`. Belt-and-suspenders with `frame-ancestors 'none'` for older browsers that do not support CSP.

**`X-Content-Type-Options`**
- Set to `nosniff`. Prevents browsers from MIME-sniffing response bodies.

**`Referrer-Policy`**
- Set to `strict-origin-when-cross-origin`. Wallet addresses must not leak via Referer headers to third-party domains (merchant logo hosts, analytics).

**`Permissions-Policy`**
- Disable all powerful features that the app does not use. At minimum: `camera=()`, `microphone=()`, `geolocation=()`, `payment=()`. The QR scanner (if implemented via camera) will require `camera=(self)` — update accordingly.

**`Strict-Transport-Security`**
- Set to `max-age=63072000; includeSubDomains; preload` for production. Do not set in development (breaks localhost).

**What to avoid:**
- Do not use `script-src 'unsafe-inline'` in production. Inline scripts are the primary XSS execution vector. Next.js does not require inline scripts in production builds (only in development via HMR).
- Do not use `script-src *` or omit `script-src` entirely. Every external script source must be explicitly whitelisted.
- Do not add `img-src *` without the HTTPS restriction. Allowing `http:` image sources enables mixed-content loading and passive content injection.
- Do not set `connect-src 'self'` alone. The SUI gRPC client in `providers.tsx` connects to `https://fullnode.testnet.sui.io:443` and equivalents — these origins must be explicitly allowed.

---

## 6. XSS / Injection — User-Supplied Strings

User-supplied strings from on-chain data (`name`, `logo_url`, `reward_description`, `merchant_name`, `merchant_logo`) arrive from the SUI RPC and must be treated as untrusted input before display or use in Move calls. The Move contract performs no URL or content validation at the contract level.

---

### SR-601-XSS — Sanitise `logo_url` and `merchant_logo` Before Display

**Severity: High**

**What to implement:**
- Before rendering a merchant logo URL in an `<img>` tag or passing it to Next.js `<Image>`, validate the URL on the client:
  - Parse it with the `URL` constructor. If it throws, reject the URL and render a placeholder.
  - Confirm the scheme is exactly `https:`. Reject `http:`, `data:`, `javascript:`, `blob:`, and any other scheme.
  - Optionally enforce that the hostname is not `localhost`, a private IP range (`10.*`, `172.16-31.*`, `192.168.*`), or a link-local address.
- Configure Next.js Image's `remotePatterns` in `next.config.ts` to restrict which hostnames `<Image>` will proxy or optimize. Only add trusted CDN and image hosting domains. Do not use a wildcard pattern (`hostname: '*'`) in `remotePatterns`.
- Display a fallback placeholder (a generic Suiki logo) for any URL that fails validation, rather than rendering an error or an empty `src`.

**What to avoid:**
- Do not pass `logo_url` or `merchant_logo` directly from on-chain data into `<img src={merchantLogo}>` without validation. The CSP `img-src` directive provides a browser-level backstop but is not a substitute for application-level validation.
- Do not render `logo_url` as a clickable anchor link. On-chain logo URLs are for image display only; making them links converts an image injection risk into a phishing link.
- Do not use React's raw HTML injection API (`innerHTML` via `useRef` mutations or the `__html` prop pattern) to render any string from on-chain data. There is no valid use case for injecting raw HTML markup from chain data into the stamp card UI.

---

### SR-602-XSS — Sanitise `name` and `reward_description` Before Display

**Severity: Medium**

**What to implement:**
- React's JSX rendering escapes string interpolation by default (`{program.name}` renders as text, not HTML). This is the correct pattern and must be preserved — never bypass React's default escaping.
- Before writing `name` or `reward_description` to the chain via `buildCreateProgram` or `buildUpdateProgram`, validate in the transaction builder or the calling UI component:
  - Non-empty string (minimum 1 character after trimming whitespace).
  - Maximum length: `name` no more than 64 characters, `reward_description` no more than 256 characters (choose bounds that match or are tighter than any Move-level validation added per FIND-11 in `Security Audit.md`).
  - Printable Unicode only. Reject control characters (0x00–0x1F, 0x7F) which can corrupt terminal-based log display and some wallet UI rendering engines.
- If any string validation fails, surface an inline form error before the transaction is built. Do not build and submit a transaction with an invalid input.

**What to avoid:**
- Do not rely solely on Move-level string validation. Move's `String` type accepts any valid UTF-8 bytes. There is no URL, length, or character set constraint enforced by the VM. Client-side validation is the only gate before the data goes on-chain permanently.
- Do not render program name or reward description via any raw HTML injection mechanism. These fields must always be rendered as plain text nodes, not as markup.
- Do not allow HTML entity encoding or Markdown interpretation in these fields. Render them as `textContent`, not as markup.

---

### SR-603-XSS — Sanitise `programId`, `cardId`, and `customerAddress` Before Use as Object Arguments

**Severity: Medium**

**What to implement:**
- Object IDs (`programId`, `cardId`) come from on-chain query results (`SuiObjectId` branded type) or from QR code payloads (`MerchantQRPayload`, `CustomerQRPayload` in `src/types/sui.ts`). Validate before passing to transaction builders:
  - Must match the pattern `/^0x[0-9a-fA-F]{64}$/` (0x-prefixed, 64 hex characters).
  - Reject any value that does not match. Display a "Invalid QR code" error rather than passing a malformed ID to the SDK.
- Customer and merchant wallet addresses (`SuiAddress` branded type) must also match the SUI address regex before they are passed to `tx.pure.address()` or `tx.object()`.
- QR code payloads must be parsed and validated with a Zod schema matching `MerchantQRPayload | CustomerQRPayload` before any field is used. A malformed or tampered QR code must not inject unexpected values into a transaction.

**What to avoid:**
- Do not pass unvalidated QR code data directly to transaction builders. A QR code is user-supplied input from an untrusted physical source.
- Do not assume that values returned from SUI RPC queries are already validated to the correct format. RPC results should be parsed through the type definitions in `src/types/sui.ts` with runtime validation.
- Do not log raw QR code payloads, especially `customerAddress` or `merchantAddress` fields.

---

## Summary Table

| ID | Severity | Area | Requirement |
|---|---|---|---|
| SR-601 | Critical | Sponsor API | Private key in server env only; never in client bundle; Vercel prod scope only |
| SR-602 | High | Sponsor API | Dual rate limit (sender + IP); Redis before mainnet; global daily cap |
| SR-603 | Critical | Sponsor API | Validate every PTB command against allowlist; reject entire PTB on any failure |
| SR-604 | High | Sponsor API | Validate and size-limit txKindBytes; validate sender address format |
| SR-605 | High | Sponsor API | Never log sponsorSignature; omit from error responses |
| SR-501 | Critical | Wallet | No private keys in frontend; sponsor key never imported client-side |
| SR-502 | High | Wallet | ConnectButton and dApp Kit hooks must be in Client Components only |
| SR-503 | Medium | Wallet | Never log full wallet addresses; truncate for display; no storage in localStorage |
| SR-701 | Critical | TX Hooks | Validate server response (type + parseability) before passing to wallet |
| SR-702 | High | TX Hooks | Never log or persist sponsorSignature; hold in local scope only |
| SR-703 | Medium | TX Hooks | Handle all failure modes with distinct user-facing messages; no silent retries |
| SR-401 | Critical | Env Vars | SPONSOR_PRIVATE_KEY server-context only; CI bundle scan; never in .env committed |
| SR-402 | Low | Env Vars | NEXT_PUBLIC_* are intentionally public; never put secrets in NEXT_PUBLIC_ |
| SR-501-CSP | High | CSP | Full CSP header set including connect-src for SUI nodes; no unsafe-inline in prod |
| SR-601-XSS | High | XSS | Validate logo_url scheme (https only) before img rendering; Next.js remotePatterns allowlist |
| SR-602-XSS | Medium | XSS | Validate name/description length and charset before on-chain write; always render as text |
| SR-603-XSS | Medium | XSS | Validate QR code payloads and object IDs against hex address regex before use |

**Severity breakdown:** 4 Critical, 7 High, 4 Medium, 1 Low, 1 Informational

---

## Cross-References

The following findings from `Docs/Security Audit.md` are directly addressed by requirements in this document:

| Security Audit Finding | Requirements |
|---|---|
| FIND-01 — Gas sponsor wallet drain | SR-603, SR-604 |
| FIND-02 — Rate limiting bypass via address proliferation | SR-602 |
| FIND-07 — Arbitrary URL injection via logo_url | SR-601-XSS, SR-602-XSS |
| FIND-09 — Private key exposure surface | SR-601, SR-401 |
| FIND-11 — Missing validation: empty string fields | SR-602-XSS |
| FIND-15 — PDPA compliance gap | SR-503 |
| FIND-16 — Transaction spoofing via malicious PTB | SR-603 |

Requirements SR-501 through SR-703 are new requirements specific to Tasks 5–7 that do not correspond to contract-level findings in the existing audit.

---

*Document date: 2026-03-25*
*Scope: Tasks 5 (Wallet Integration), 6 (Sponsor API), 7 (Transaction Hooks)*
*Author: Claude Sonnet 4.6 (AI Security Review — not a substitute for professional security assessment)*
