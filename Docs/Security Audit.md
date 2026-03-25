---
title: "Suiki — Smart Contract & API Security Audit"
date: 2026-03-25
status: open
auditor: Claude Sonnet 4.6 (AI Security Review)
contract: move/suiki/sources/suiki.move
version: pre-deploy (not yet on mainnet)
tags:
  - project/suiki
  - security/audit
  - blockchain/sui
  - type/security-report
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — Smart Contract & API Security Audit

> **Scope:** Move smart contract (`suiki::suiki`), Next.js gas sponsor API (`/api/sponsor`), and their interaction surface. Contract is pre-deployment; all findings are **Open**.

---

## Executive Summary

The Suiki Move contract is well-structured for a loyalty stamp card MVP. It correctly uses SUI's object model, applies `assert!` guards on all state-mutating functions, and leverages the type system to prevent reentrancy. The most significant risks are not in the core logic but in three areas: (1) the gas sponsor API is a high-value target for wallet drain attacks; (2) the shared-object model creates a denial-of-service surface against individual merchant programs; and (3) several missing input validations allow degenerate on-chain state that can break client UX permanently.

**Overall posture: Medium risk pre-launch.** None of the findings are systemic protocol-level flaws. All are fixable before mainnet deployment.

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Can cause immediate, irreversible fund loss or total system compromise |
| **High** | Can cause significant harm — fake stamps, invalid redemptions, wallet drain |
| **Medium** | Degrades system integrity or UX in ways that are hard to recover from |
| **Low** | Minor issues — edge cases, operational risk, limited blast radius |
| **Info** | Observations and best-practice notes with no direct exploit path |

---

## Findings

---

### FIND-01 — Gas Sponsor Wallet Drain via Unrestricted Transaction Sponsoring

**Severity:** Critical
**Component:** API (`/api/sponsor`)
**Status:** Open

**Description:**
The sponsor endpoint receives arbitrary serialized transaction bytes and a `senderAddress`, then signs and pays gas on behalf of the sender. There is no on-chain or off-chain verification that the transaction being sponsored actually calls a `suiki::suiki` function. An attacker can construct any transaction — including one that transfers SUI tokens, calls a third-party contract, or performs an expensive computation — and submit it to `/api/sponsor` to have the sponsor wallet pay gas.

**Attack vector:**
1. Attacker crafts a transaction that calls `sui::coin::transfer<SUI>` to themselves for any amount they hold, or simply a no-op infinite loop that burns compute budget.
2. POST `{ tx: <serialized_malicious_tx>, senderAddress: <attacker_address> }` to `/api/sponsor`.
3. Server signs without validating intent. Gas is deducted from sponsor wallet.
4. Attacker repeats at maximum rate until sponsor wallet is empty.

Even with rate limiting in place (50 tx/merchant/day per the design spec), the check is against `senderAddress` not a verified merchant identity. An attacker with N addresses gets N * 50 sponsored transactions per day for free.

**Recommendation:**
- Deserialize the transaction bytes server-side before signing. Use the SUI TypeScript SDK's `Transaction.from()` to parse the transaction and inspect the move calls list.
- Reject any transaction that does not contain exclusively `suiki::<MODULE_ADDRESS>::suiki::*` function calls.
- Maintain an allowlist of permitted function names: `create_program`, `create_card_and_stamp`, `issue_stamp`, `redeem`, `update_program`.
- Consider requiring a signed challenge from a wallet that is registered as a merchant on-chain before sponsoring their transactions, to prevent Sybil abuse with many addresses.

---

### FIND-02 — Rate Limiting Bypass via Address Proliferation

**Severity:** High
**Component:** API (`/api/sponsor`)
**Status:** Open

**Description:**
The design spec limits sponsored transactions to 50 per merchant per day. If this limit is keyed on `senderAddress` (the most natural implementation), any actor can create unlimited SUI addresses at zero cost and bypass the rate limit entirely. SUI address generation is free, instant, and requires no registration.

**Attack vector:**
1. Script generates 1,000 SUI wallet addresses.
2. Each address submits 50 sponsored transactions per day.
3. 50,000 free sponsored transactions per day drain the sponsor wallet.

**Recommendation:**
- Rate-limit per IP address as a secondary control in addition to per-address limits.
- Require on-chain proof of merchant registration (i.e., the sender must own or have created at least one `StampProgram` object) before any sponsoring occurs. A `StampProgram` costs at minimum one transaction to create, raising the cost per attack identity.
- Implement token-bucket rate limiting at the infrastructure layer (Vercel Edge Config, Upstash Redis) with a global daily cap on total sponsored transactions regardless of address count.

---

### FIND-03 — Shared Object Contention Denial of Service

**Severity:** High
**Component:** Move contract (`StampProgram`, `StampCard`)
**Status:** Open

**Description:**
Both `StampProgram` and `StampCard` are shared objects. In SUI, concurrent transactions that require mutable access (`&mut`) to the same shared object are serialized by the validators — they cannot execute in parallel. A single high-traffic `StampProgram` (imagine a popular carinderia during lunch hour with a queue of 20 customers) will have all its `issue_stamp` transactions queued. Under normal SUI throughput this is fine. However, a malicious actor who wants to grief a specific merchant can flood the mempool with low-value transactions against that merchant's `StampProgram` to starve legitimate customer transactions.

More concretely: the `total_issued` counter in `StampProgram` is mutated by both `create_card_and_stamp` and `issue_stamp`. Any caller who has a reference to the program object can contend on it. Since `StampProgram` is public and shared, its object ID is discoverable by anyone.

**Attack vector:**
1. Attacker discovers merchant's `StampProgram` object ID from chain state.
2. Attacker submits a high volume of `issue_stamp` calls against the program (will fail at the `ENotMerchant` assert, but these transactions still consume a slot in the object's serialization queue during execution).
3. Legitimate merchant transactions are delayed.

Note: failed transactions on SUI still consume gas from the sender, not the sponsor, so this attack is bounded by the attacker's own SUI balance. However, the griefing still degrades merchant UX.

**Recommendation:**
- The `total_issued` counter on `StampProgram` is the primary contention driver. Consider moving analytics (total issued count) off-chain via event indexing rather than tracking it as shared mutable state. `StampIssued` events already carry the data needed to reconstruct totals client-side.
- Removing the `total_issued` mutation from `issue_stamp` would allow that function to take `&StampProgram` (immutable) instead of `&mut StampProgram`, which eliminates contention on the program object for the most common operation entirely.
- `create_card_and_stamp` still requires `&mut StampProgram` (to increment `total_issued`). If `total_issued` is dropped, this also becomes immutable-safe.

---

### FIND-04 — Missing Input Validation: `stamps_required = 0`

**Severity:** High
**Component:** Move contract (`create_program`)
**Status:** Open

**Description:**
`create_program` accepts `stamps_required: u64` with no lower-bound validation. If a merchant (or a buggy client) passes `0`, the resulting `StampProgram` has `stamps_required == 0`. Any customer whose `StampCard` is associated with this program can call `redeem` immediately after the card is created — or even on a card with `current_stamps == 0` — because the guard `card.current_stamps >= program.stamps_required` evaluates as `0 >= 0 == true`.

This means a `stamps_required = 0` program becomes an instant infinite free reward dispenser. Any customer can create a card and immediately redeem an unlimited number of times (resetting `current_stamps` from `0` back to `0` and incrementing `total_earned` each time).

**Attack vector:**
1. Malicious or buggy client calls `create_program` with `stamps_required = 0`.
2. Any customer calls `redeem` on any card for that program at zero cost, incrementing `total_earned` arbitrarily.
3. If `total_earned` is used as a reputation primitive in V2 (the design spec mentions "loyalty score as credit primitive"), this corrupts that data for the merchant's entire customer base.

**Recommendation:**
Add the following assertion to `create_program`:
```move
assert!(stamps_required > 0, EInvalidStampsRequired);
```
And define a new error constant `const EInvalidStampsRequired: u64 = 4;`.

Also add an upper-bound sanity check to prevent pathologically large values (e.g., `assert!(stamps_required <= 1000, EInvalidStampsRequired)`).

---

### FIND-05 — `total_earned` Accounting Error on Redemption

**Severity:** Medium
**Component:** Move contract (`redeem`)
**Status:** Open

**Description:**
The `redeem` function computes:
```move
card.total_earned = card.total_earned + card.current_stamps;
card.current_stamps = 0;
```

This adds `current_stamps` (the earned-but-not-yet-redeemed count) to `total_earned` at redemption time. However, `current_stamps` can exceed `stamps_required` if a merchant issues extra stamps (e.g., stamps for a bonus visit). The design intent is to count **redeemed cycles**, not raw stamp counts, in `total_earned`.

More problematically: the `StampRedeemed` event emits the new `total_earned` value, which is used by the spec's V2 analytics. The off-chain indexer treating `total_earned` as "number of rewards earned" will miscount if `current_stamps > stamps_required` at redemption time — it cannot distinguish one big redemption from multiple smaller ones.

The field name `total_earned` is also semantically ambiguous: does it mean "total stamps ever issued" or "total reward cycles completed"? This needs to be settled before the off-chain analytics layer is built.

**Recommendation:**
Decide the semantic and enforce it:
- If `total_earned` means "reward cycles completed," change the redemption to:
  ```move
  card.total_earned = card.total_earned + 1;
  card.current_stamps = card.current_stamps - program.stamps_required;
  // remainder stamps carry over instead of being lost
  ```
  This also fixes the related stamp-loss issue (see FIND-06).
- If `total_earned` means "lifetime stamps issued to this card," rename the field to `lifetime_stamps` for clarity and add a separate `rewards_earned: u64` counter that increments by 1 per redemption cycle.

---

### FIND-06 — Excess Stamps Lost on Redemption

**Severity:** Medium
**Component:** Move contract (`redeem`)
**Status:** Open

**Description:**
When a customer redeems, `current_stamps` is reset to `0` regardless of how many stamps were accumulated. If a customer has collected 12 stamps on a 10-stamp program (e.g., because a merchant issued bonus stamps), the 2 extra stamps are silently discarded.

This is a trust issue: the blockchain's on-chain state says 2 stamps were legitimately issued (verifiable via events), but after redemption those stamps vanish. Customers who notice this will lose trust in the system.

**Attack vector:** This is not an exploit, but a UX integrity issue. A merchant could deliberately issue extra stamps to a customer as a bonus, only for those stamps to disappear on redemption.

**Recommendation:**
Change the redemption logic to subtract only the required stamps and carry the remainder forward:
```move
card.current_stamps = card.current_stamps - program.stamps_required;
card.total_earned = card.total_earned + 1;
```
This also requires validating `current_stamps >= program.stamps_required` which is already done by the `ENotEnoughStamps` guard.

---

### FIND-07 — Arbitrary URL Injection via `logo_url` / `merchant_name` Fields

**Severity:** Medium
**Component:** Move contract (`create_program`, `update_program`) + SUI Display
**Status:** Open

**Description:**
`logo_url` is stored as an unconstrained `String` in both `StampProgram` and `StampCard`. The SUI Display standard renders the card's `image_url` directly from `{merchant_logo}` (which is populated from `program.logo_url` at card creation time). There is no validation of URL format, scheme, or domain.

**Consequences:**
1. **Phishing via QR-linked card display:** A malicious merchant could set `logo_url` to a phishing page URL (`https://evil.com/fake-slush-login`). When a customer views their StampCard in Slush wallet, the wallet fetches and displays this image. Slush wallet's image rendering is sandboxed (no script execution), but:
   - The URL itself is visible to the customer and can be confusing.
   - If a future wallet version or display context renders the URL as a clickable link, it becomes a direct phishing vector.
2. **Data URI / JavaScript URI injection:** While SUI SDK's String type does not validate URI schemes, if any client-side rendering later passes `logo_url` to `<img src={logo_url}>` without sanitization, an attacker could inject `javascript:` URIs on older browsers.
3. **Merchant impersonation:** A bad actor creates a program with `name = "Jollibee Loyalty Program"` and `logo_url` pointing to Jollibee's official logo, creating a convincing fake program to steal customer redemptions.

**Recommendation:**
- The Move contract itself cannot perform robust URL validation (no regex in Move). Add server-side validation in the Next.js transaction builder (`src/lib/transactions.ts`) before constructing the transaction: enforce HTTPS scheme, reject data URIs and javascript URIs, and optionally enforce a domain allowlist.
- Add a front-end warning when a program's `logo_url` points to an external domain not on a trusted CDN list.
- Consider storing merchant metadata (name, logo) off-chain (Walrus decentralized storage or IPFS) with a content hash stored on-chain, so the hash serves as tamper-evidence.

---

### FIND-08 — Merchant Transfer Lock: No Mechanism to Transfer Program Ownership

**Severity:** Medium
**Component:** Move contract (`StampProgram`)
**Status:** Open

**Description:**
`StampProgram.merchant` is set at creation time to `ctx.sender()` and is never updated. There is no `transfer_ownership` function. If a merchant's wallet is compromised, lost, or the merchant sells their business, there is no way to reassign the `merchant` field to a new address.

This is permanent — since `StampProgram` is a shared object, it cannot be deleted or re-created with the same identity. Customers with existing `StampCard` NFTs linked to the old `program_id` would be permanently locked out of receiving new stamps or redemptions, because the `ENotMerchant` guard will always check against the original address.

**Attack vector:** Key loss scenario — merchant loses access to their wallet. All existing customer cards become permanently non-functional with no recovery path.

**Recommendation:**
Add a `transfer_merchant` function:
```move
public fun transfer_merchant(
    program: &mut StampProgram,
    new_merchant: address,
    ctx: &TxContext,
) {
    assert!(program.merchant == ctx.sender(), ENotMerchant);
    program.merchant = new_merchant;
}
```
Consider a two-step transfer (propose + accept) to prevent accidental transfers to wrong addresses.

---

### FIND-09 — Private Key Exposure Surface in Vercel Deployment

**Severity:** High
**Component:** API (`/api/sponsor`), Infrastructure
**Status:** Open

**Description:**
The sponsor private key (`SPONSOR_PRIVATE_KEY`) is stored as a Vercel environment variable and loaded at runtime by the API route. This is the correct pattern for server-side secrets; however, several exposure vectors exist:

1. **Vercel log drain:** If the API route ever logs request details (even accidentally via `console.log(ctx)` or an unhandled exception stack trace), the private key could appear in log output if it is accidentally included in serialization.
2. **Build-time exposure:** If `SPONSOR_PRIVATE_KEY` is accidentally prefixed with `NEXT_PUBLIC_`, it will be embedded in the client bundle and exposed to all users.
3. **GitHub Actions / CI exposure:** If CI logs or environment inspection commands (`printenv`, `env`) run in a context where Vercel secrets are injected, they may be printed.
4. **Vercel preview deployments:** Preview deploys inherit production environment variables by default unless explicitly scoped. A public preview URL means anyone can call `/api/sponsor` against the production sponsor wallet.

**Recommendation:**
- Confirm `SPONSOR_PRIVATE_KEY` is never prefixed with `NEXT_PUBLIC_`. Use a linter rule or CI check to enforce this.
- Scope the environment variable to Production environment only in Vercel — do not inject it into Preview or Development environments.
- Use a hardware wallet or KMS (AWS KMS, Google Cloud KMS) for the sponsor key in production rather than a raw private key string. The SUI TypeScript SDK supports custom signers.
- Set up a low-balance sponsor wallet with automatic top-up from a cold wallet (rather than keeping a large balance in the hot sponsor wallet), limiting maximum loss from key compromise.
- Add structured logging that explicitly excludes the private key variable from any serialization.

---

### FIND-10 — No Replay Attack Protection on Sponsor API

**Severity:** Medium
**Component:** API (`/api/sponsor`)
**Status:** Open

**Description:**
SUI transactions are inherently replay-safe at the protocol level because each transaction references a specific epoch and uses a deterministic digest. Once a transaction is executed on-chain, replaying the identical bytes will fail because the transaction digest is already recorded.

However, the sponsor API adds a second signature (the sponsor's signature) to the transaction. If an attacker captures a signed sponsored transaction before it is submitted to the network (e.g., via a MITM on the response from `/api/sponsor`), they could submit it themselves or hold it and submit it later in a different epoch context. Whether this constitutes a meaningful replay depends on SUI's epoch-bound transaction validity.

More concretely: the sponsor API does not verify that the transaction has not already been submitted. A bug in the client that submits the same transaction twice will result in the first succeeding and the second failing (protocol-level protection), but the sponsor API will sign both, wasting gas signing compute and potentially exposing the signing service to enumeration attacks.

**Recommendation:**
- This is largely mitigated by SUI's protocol-level transaction digest uniqueness. Document this explicitly in the API code so future maintainers do not re-introduce an off-chain nonce scheme that conflicts with it.
- Add idempotency at the API layer: cache transaction digests seen in the last 60 seconds (using Vercel KV or an in-memory LRU cache) and reject duplicate requests.

---

### FIND-11 — Missing Validation: Empty String Fields

**Severity:** Low
**Component:** Move contract (`create_program`, `update_program`)
**Status:** Open

**Description:**
`create_program` and `update_program` accept `name`, `logo_url`, and `reward_description` as `String` with no minimum length validation. A merchant (or a buggy client) can create a program with empty strings for all fields. The resulting `StampProgram` will render in Slush wallet as a card with no name, no image, and no reward description, causing customer confusion.

More importantly, `name` is copied into every `StampCard` created under the program at `create_card_and_stamp` time. If a program is created with an empty name and then the merchant later calls `update_program` with a real name, all previously created `StampCard` objects still carry the old empty name in their `merchant_name` field. The SUI Display standard reads from `{merchant_name}` on the card object itself, not the program, so cards become permanently misnamed unless individually updated.

**Recommendation:**
- Add server-side validation in the Next.js transaction builder to enforce non-empty strings before constructing the transaction.
- Consider adding a Move-level assertion: `assert!(name.length() > 0, EInvalidName)` with a new error constant.
- For `merchant_name` staleness: document that `StampCard.merchant_name` is a snapshot at card creation time and is not automatically updated when `update_program` is called. This is a design choice, not a bug, but it must be communicated clearly to merchants.

---

### FIND-12 — `u64` Overflow in Stamp Counters

**Severity:** Low
**Component:** Move contract (`issue_stamp`, `create_card_and_stamp`, `redeem`)
**Status:** Open

**Description:**
Stamp counters (`current_stamps`, `total_earned`, `total_issued`) are `u64`. In Move on SUI, arithmetic overflow on `u64` causes an **abort** (transaction failure), not a silent wrap-around. This is safer than Solidity but still worth noting.

In practice, `u64::MAX` is `18,446,744,073,709,551,615`. No real loyalty program will approach this limit. However, `total_issued` on `StampProgram` is a shared mutable counter incremented by every stamp ever issued. For a highly active program with millions of customers over years, this counter will grow but will never overflow in any realistic scenario.

**Recommendation:**
This is informational. No code change required. Document that Move's overflow-abort behavior is the intended safety net. If the `total_issued` counter is removed (per FIND-03 recommendation), this concern disappears for the most frequently mutated path.

---

### FIND-13 — No Mechanism to Close or Pause a Stamp Program

**Severity:** Low
**Component:** Move contract (`StampProgram`)
**Status:** Open

**Description:**
Once created, a `StampProgram` is permanent. There is no `close_program`, `pause_program`, or `set_active` function. If a merchant closes their business, moves to a different platform, or creates a program by mistake, they have no way to stop new cards from being created or new stamps from being issued.

The `StampProgram` object will exist on-chain forever with `stamps_required` set to whatever value was used at creation. Customers holding cards for a closed program will see an active-looking card in their wallet indefinitely.

**Recommendation:**
Add an `active: bool` field to `StampProgram` and an `is_active` check in `create_card_and_stamp` and `issue_stamp`. Provide a `deactivate_program` function callable only by the merchant. Deactivated programs should not accept new stamps or card creations but should allow existing customers to finish redeeming any accumulated stamps.

---

### FIND-14 — `StampCard.customer` Cannot Be Updated: No Card Recovery

**Severity:** Low
**Component:** Move contract (`StampCard`)
**Status:** Open

**Description:**
`StampCard.customer` is set at card creation time and never changed. The redemption guard checks `card.customer == ctx.sender()`. If a customer loses access to their wallet, their accumulated stamps are permanently locked. There is no mechanism for the merchant to reassign a card to a new customer address (even with proof of identity).

This is a weaker version of FIND-08 but affects customers rather than merchants.

**Recommendation:**
For MVP this is acceptable — document it explicitly as a known limitation. For V2, consider a `reassign_card` function callable only by the merchant (who has the customer relationship) with appropriate access control, to allow card recovery after wallet migration.

---

### FIND-15 — PDPA (Philippines Data Privacy Act) Compliance Gap

**Severity:** Medium
**Component:** Overall system design
**Status:** Open

**Description:**
The Philippines Data Privacy Act of 2012 (Republic Act 10173) imposes obligations on personal information controllers. Suiki stores the following data that may constitute personal information under PDPA:

1. **On-chain (permanent, public):** Customer SUI wallet addresses are stored in `StampCard.customer` and emitted in all events (`CardCreated`, `StampIssued`, `StampRedeemed`). Wallet addresses are pseudonymous but can be linked to real identities via on-ramp KYC records (Coins.ph, PDAX).
2. **Off-chain (V2 Supabase):** The design spec plans to mirror events to Supabase Postgres for analytics. If customer wallet addresses are stored in Supabase, Supabase becomes a personal data processor under PDPA.
3. **Right to erasure:** PDPA grants individuals the right to request deletion of their personal data. On-chain data is immutable — wallet addresses embedded in `StampCard` objects and events **cannot be deleted**. This is a structural tension between blockchain immutability and PDPA erasure rights.
4. **Merchant logo URLs:** Logo URLs may point to personal social media photos (Facebook profile pictures, Google Drive photos of the merchant). These could be considered personal data.

**Recommendation:**
- Engage a Philippine data privacy lawyer before MVP launch to determine whether wallet addresses constitute "personal information" under PDPA in the context of a pseudonymous blockchain.
- Register with the National Privacy Commission (NPC) as a Personal Information Controller if required.
- For the Supabase analytics layer (V2): implement data minimization — store analytics aggregates, not raw wallet addresses. If addresses must be stored, use a one-way hash (HMAC-SHA256 with a server-side secret) so the record cannot be linked back to a wallet address without the server secret.
- Add a privacy policy and Terms of Service that explicitly disclose blockchain immutability to users before they connect their wallet.
- Do not use personal photos as merchant logos — enforce HTTPS URLs to dedicated image hosting (Cloudinary, Walrus, IPFS) in the transaction builder.

---

### FIND-16 — Transaction Spoofing via Malicious PTB Construction

**Severity:** High
**Component:** API (`/api/sponsor`) + client
**Status:** Open

**Description:**
SUI uses Programmable Transaction Blocks (PTBs), which allow chaining multiple move calls in a single transaction. A malicious client can construct a PTB that contains both a legitimate `suiki::issue_stamp` call (to pass the function allowlist check recommended in FIND-01) and additional malicious move calls after it — for example, transferring objects or interacting with a DeFi protocol.

If the sponsor API only checks that at least one call is to `suiki::*`, a combined PTB slips through.

**Attack vector:**
1. Attacker constructs a PTB: `[suiki::issue_stamp(...), sui::transfer::transfer(attacker_coin, attacker_address)]`.
2. Submits to `/api/sponsor`.
3. If the API only checks for the presence of a `suiki::*` call, it signs the entire PTB.
4. Both calls execute. The legitimate stamp is issued AND the attacker's transfer executes, sponsored by Suiki.

**Recommendation:**
When validating the transaction in `/api/sponsor`, iterate **all** move calls in the PTB and verify **every** call is in the `suiki::*` allowlist. Reject any PTB that contains calls to any other module or package address. This must be an allowlist of `(package_id, module, function)` triples, not just module name prefix matching.

---

## Summary Table

| ID | Component | Severity | Title |
|---|---|---|---|
| FIND-01 | API | Critical | Gas sponsor wallet drain via unrestricted transaction sponsoring |
| FIND-02 | API | High | Rate limiting bypass via address proliferation |
| FIND-03 | Contract | High | Shared object contention denial of service |
| FIND-04 | Contract | High | Missing validation: `stamps_required = 0` enables infinite free redemptions |
| FIND-05 | Contract | Medium | `total_earned` accounting error on redemption |
| FIND-06 | Contract | Medium | Excess stamps lost on redemption |
| FIND-07 | Contract | Medium | Arbitrary URL injection via `logo_url` / `merchant_name` fields |
| FIND-08 | Contract | Medium | No mechanism to transfer merchant ownership |
| FIND-09 | Infrastructure | High | Private key exposure surface in Vercel deployment |
| FIND-10 | API | Medium | No replay attack protection on sponsor API |
| FIND-11 | Contract | Low | Missing validation: empty string fields |
| FIND-12 | Contract | Low | `u64` overflow in stamp counters (Move abort behavior) |
| FIND-13 | Contract | Low | No mechanism to close or pause a stamp program |
| FIND-14 | Contract | Low | `StampCard.customer` cannot be updated — no card recovery |
| FIND-15 | Compliance | Medium | PDPA (Philippines Data Privacy Act) compliance gap |
| FIND-16 | API | High | Transaction spoofing via malicious PTB construction |

**Severity breakdown:** 1 Critical, 4 High, 5 Medium, 4 Low, 0 Info

---

## Pre-Mainnet Remediation Priority

Address these before deploying to mainnet, in priority order:

### Must Fix (Critical + High — blocks mainnet launch)

1. **FIND-01** — Validate all PTB calls are `suiki::*` only before signing.
2. **FIND-16** — Validate ALL calls in a PTB, not just the first.
3. **FIND-04** — Add `assert!(stamps_required > 0)` to `create_program`.
4. **FIND-02** — Implement global tx cap + on-chain merchant registration check before sponsoring.
5. **FIND-09** — Scope sponsor key to Production only; minimize wallet balance; plan KMS migration.
6. **FIND-03** — Remove `total_issued` from shared mutable state; track via event indexing instead.

### Should Fix (Medium — fix before public beta)

7. **FIND-06** — Carry excess stamps forward on redemption instead of discarding.
8. **FIND-05** — Clarify `total_earned` semantics; align with FIND-06 fix.
9. **FIND-08** — Add `transfer_merchant` function.
10. **FIND-07** — Add server-side URL validation in transaction builder.
11. **FIND-10** — Add PTB digest idempotency cache on sponsor API.
12. **FIND-15** — Engage PDPA legal counsel; add privacy policy before user onboarding.

### Nice to Have (Low — before V2 or GA)

13. **FIND-11** — Add non-empty string validation.
14. **FIND-13** — Add `active` flag and `deactivate_program`.
15. **FIND-14** — Document card recovery limitation; plan `reassign_card` for V2.
16. **FIND-12** — Informational; document only.

---

## What the Contract Does Well

- **Reentrancy:** Move's ownership model and linear type system make reentrancy structurally impossible. No finding here.
- **Access control baseline:** Every state-mutating function has an `assert!` guard. Merchant operations check `program.merchant == ctx.sender()`. Customer operations check `card.customer == ctx.sender()`. No privilege escalation path found.
- **Object ID spoofing:** The `EProgramMismatch` check (`card.program_id == object::id(program)`) uses SUI's object identity, not a developer-supplied ID, making spoofing impossible at the Move level.
- **Shared object design:** The decision to make `StampCard` a shared object (so both merchant and customer can interact with it) is the correct architectural choice for this use case and is well-documented in the implementation plan.
- **Display standard:** Using SUI's `Display` standard for NFT metadata is idiomatic and gives merchants live visual updates across all customer wallets without re-minting — a genuine product advantage.
- **No token movement in MVP:** Stamps are non-fungible objects with no token value. This avoids BSP VASP regulatory exposure for the MVP and simplifies the security surface significantly.
- **Events:** Comprehensive event emission on all state changes provides a clean off-chain indexing surface for V2 analytics.

---

*Audit date: 2026-03-25*
*Auditor: Claude Sonnet 4.6 (AI Security Review — not a substitute for professional smart contract audit)*
*Recommendation: Engage a professional Move auditor (e.g., OtterSec, Zellic, or a SUI ecosystem specialist) before mainnet deployment, particularly for FIND-01, FIND-02, FIND-03, and FIND-04.*
