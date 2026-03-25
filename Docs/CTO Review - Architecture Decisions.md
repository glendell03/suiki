---
title: "Suiki — CTO Architecture Review"
date: 2026-03-25
status: active
author: CTO Review
tags:
  - project/suiki
  - type/adr
  - stage/review
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — CTO Architecture Review

> Architecture Decision Records for the Suiki MVP. Each ADR documents the decision made, why, what was rejected, and what risks remain. Written for the grant application record and for the implementation team.

---

## Table of Contents

- [ADR-001: StampCard as Shared Object](#adr-001-stampcard-as-shared-object)
- [ADR-002: Gas Sponsorship via Next.js API Route](#adr-002-gas-sponsorship-via-nextjs-api-route)
- [ADR-003: Logo URL Storage — Plain String On-Chain](#adr-003-logo-url-storage--plain-string-on-chain)
- [ADR-004: No Database in MVP — 100% On-Chain Queries](#adr-004-no-database-in-mvp--100-on-chain-queries)
- [ADR-005: Move 2024.beta Edition](#adr-005-move-2024beta-edition)
- [ADR-006: StampCard Display Metadata Staleness](#adr-006-stampcard-display-metadata-staleness)
- [Open Questions Before Mainnet](#open-questions-before-mainnet)

---

## ADR-001: StampCard as Shared Object

**Status:** Accepted with known trade-offs

### Decision

`StampCard` is a shared object. Both the merchant (to call `issue_stamp`) and the customer (to call `redeem`) can interact with it by passing a mutable reference.

### Context

SUI has two ownership models for objects that matter here:

- **Owned object** — only the owner's transaction can pass it by value or mutable reference. A customer-owned `StampCard` could not be mutated by a merchant's `issue_stamp` call.
- **Shared object** — any address can pass it as an argument to a transaction. Concurrent access is serialized through consensus.

The core product requirement is that a merchant stamps a customer's card. The merchant and customer are different addresses. This makes shared objects the natural fit.

### Alternatives Considered

**Option A: Owned by customer, with a capability pattern.**
Merchant holds a `MerchantCap` capability object. `issue_stamp` takes `_cap: &MerchantCap` instead of checking `ctx.sender()`. The customer would still need to be present in the transaction or the card would still need to be passed — so the card still needs to be shared or transferred. This does not solve the mutual-access problem; it only moves where the authorization check lives. Rejected as adding complexity without benefit.

**Option B: Merchant-owned card with transfer to customer on redemption.**
Merchant holds the card as a wrapped object inside `StampProgram` (via `Table<address, StampCard>` or `dynamic_field`). This eliminates sharing on the card itself, since `StampProgram` is already shared. The merchant always has mutable access, and the customer would need a separate call to "claim" their reward. Rejected for MVP because it fundamentally changes the product — the customer does not own their card, which breaks the "stamps as customer-owned NFTs" value proposition.

**Option C: Dynamic fields on the shared `StampProgram`.**
Store stamp counts as `dynamic_field::add(program_id, customer_address, u64)` instead of creating individual card objects. This eliminates the need for per-card shared objects entirely. The program object is already shared; stamp counts are just fields on it. Rejected because it destroys the NFT property — individual `StampCard` objects are what appear in customer wallets, drive Display metadata, and are the core product differentiator. A `u64` dynamic field is invisible to wallet UIs.

**Option D: Kiosk or transfer policy for conditional access.**
SUI's Kiosk standard provides controlled access to objects stored in a shared kiosk. Overly complex for an MVP. Rejected.

### Consequences

**Positive:**
- Semantically correct — the card is truly shared between merchant and customer.
- Simple authorization: `program.merchant == ctx.sender()` for stamping, `card.customer == ctx.sender()` for redeeming. No capability objects needed.
- Consistent with how SUI applications that require multi-party interaction (DEXs, escrows, games) work.

**Negative — Consensus Cost:**
Shared objects require consensus ordering before execution. SUI currently serializes access to shared objects within a checkpoint. Each `issue_stamp` call on a given card is sequential, not parallel. At one merchant, one customer, one card — this is fine. At 100 merchants issuing stamps simultaneously on their own cards, there is no contention because each card is a distinct shared object. Contention only occurs if a single card receives multiple concurrent stamp attempts, which is not a realistic scenario for a stamp card.

Latency impact: ~600ms for shared object transactions vs. ~400ms for owned object transactions. For a stamp card tap, 600ms is imperceptible.

**Negative — Wallet Visibility:**
Shared objects do not appear in wallet "Objects owned by address" queries because they are not owned. The `suiClient.getOwnedObjects()` call will not return `StampCard` objects. The Suiki PWA must use the event-based query pattern (`fetchCustomerCards` via `CardCreated` events) to find a customer's cards. This is already implemented correctly in `queries.ts`.

**Consequence for Slush wallet:** The "My NFTs" tab in Slush will not display `StampCard` NFTs because Slush queries owned objects. The Display standard metadata will not render in-wallet. Cards are only visible through the Suiki PWA. This is acceptable for MVP but must be addressed post-MVP.

### Recommendation

Accept the decision. The trade-offs are understood and bounded. The alternative (owned cards) breaks the customer ownership story, which is the core blockchain value proposition. Document the wallet visibility limitation clearly for the grant application narrative — it demonstrates architectural maturity to name known limitations.

**Post-MVP path:** Investigate whether a kiosk-wrapped approach can provide owned-object wallet visibility while allowing merchant mutation through kiosk transfer policies. This is a known active area in the SUI ecosystem.

---

## ADR-002: Gas Sponsorship via Next.js API Route

**Status:** Accepted for MVP — requires hardening before mainnet

### Decision

A Next.js API route at `/api/sponsor` holds an `Ed25519Keypair` loaded from `process.env.SPONSOR_PRIVATE_KEY`. It receives unsigned transaction kind bytes from the client, builds the full sponsored transaction, signs the gas portion, and returns the bytes and sponsor signature. The client signs with the user's wallet and submits both signatures.

### Context

SUI's native sponsored transaction model requires two signatures: the user's signature over the transaction data and the gas owner's signature over the same bytes. The sponsor is any address that agrees to pay gas. The implementation in `route.ts` is mechanically correct per the SUI SDK.

### Security Analysis

**Risk 1: Private key exposure.**
The sponsor private key lives as an environment variable in the Vercel serverless environment. This is the standard pattern for server-side signing in web3. Vercel encrypts environment variables at rest and does not expose them to client bundles. The risk is a Vercel account compromise or a `.env.local` file committed to a public repository.

Mitigation already in place: `.env.local` should be in `.gitignore`. Vercel secrets are isolated per-project.

Mitigation missing: There is no key rotation strategy. If the key is compromised, there is no mechanism to rotate to a new sponsor address without changing the on-chain gas owner. For the SUI network, any valid keypair can be a gas sponsor — rotation means deploying a new key, re-funding the address, and updating the environment variable. This is operationally straightforward but must be documented.

**Risk 2: The sponsor API is an open relay.**
The current implementation in `route.ts` accepts any `{ txKindBytes, sender }` from any caller. There is no authentication, no per-sender rate limiting, and no validation that the transaction kind bytes represent a legitimate Suiki operation. An attacker can call `/api/sponsor` directly and drain the sponsor wallet by constructing arbitrary transactions.

The design spec mentions rate limiting (50 tx/merchant/day for free tier) but the implementation plan does not include any enforcement logic in the sponsor route. **This is the most critical gap in the current design.** Before mainnet, this route must validate:

1. That the transaction calls only permitted function targets (`issue_stamp`, `create_card_and_stamp`, `redeem`, `create_program`).
2. Per-sender rate limits enforced server-side (requires a store — Redis or Supabase).
3. Request authentication — at minimum, verify the sender address by requiring a signed message or a session token tied to a wallet-connected session.

**Risk 3: Gas object depletion timing.**
The sponsor route fetches gas objects at request time. Under high concurrency, two requests could select the same gas coin, causing one to fail. The SUI SDK's `tx.build({ client })` will call `selectCoins` internally, which may hit this race. For MVP volume (tens of transactions), this is not a concern. At scale, implement a gas coin pool with reservation logic.

**Risk 4: NEXT_PUBLIC_ vs server-only constants.**
`SPONSOR_PRIVATE_KEY` correctly has no `NEXT_PUBLIC_` prefix and is never imported in client components. The `getSponsorKeypair()` function is only called inside the API route. This is correct. Any future refactoring that moves this function to a shared lib must not add the `NEXT_PUBLIC_` prefix.

### Alternatives Considered

**Option A: SUI native Gas Station (noblocks.network, Shinami, Enoki).**
Third-party gas stations provide managed sponsorship with built-in rate limiting, key custody, and dashboards. Shinami and Enoki specifically support SUI. This is the more operationally mature choice. Rejected for MVP because it adds a third-party dependency, costs money, and requires API key management. Acceptable for mainnet.

**Option B: zkLogin + Enoki for gasless onboarding.**
SUI's zkLogin allows social-login wallets where gas can be sponsored by the app without the user holding any SUI. This is a significant UX improvement — no Slush wallet required. Rejected for MVP because it requires integrating OAuth providers and changes the wallet connection architecture fundamentally. Strong candidate for V2.

**Option C: Merchant self-sponsors.**
Merchants pay their own gas. No sponsor route needed. Rejected because zero-gas-for-merchants is a core product promise and a key differentiator vs. traditional loyalty platforms.

### Consequences

The current sponsor route implementation is functional but insecure for production use. It will work correctly on testnet for the grant demo. It must not be deployed to mainnet without rate limiting and request validation.

### Recommendation

For the grant application demo on testnet: ship as-is, note it as a known MVP simplification.

For mainnet readiness, implement in this order:

1. Add per-sender rate limiting using an in-memory store (acceptable for single-instance Vercel free tier) or Upstash Redis (recommended for production). The rate limit counter key is the sender address. Window is 24 hours. Limit is 50 for free tier.
2. Add transaction kind validation: deserialize the `txKindBytes`, extract the `MoveCall` targets, and assert they match the permitted function list. Reject anything else.
3. Evaluate replacing the home-rolled sponsor with Shinami or Enoki for mainnet to offload key custody.

---

## ADR-003: Logo URL Storage — Plain String On-Chain

**Status:** Accepted for MVP — centralization risk documented

### Decision

`StampProgram.logo_url` and `StampCard.merchant_logo` store logo images as plain URL strings. The merchant pastes any publicly accessible URL. No file upload infrastructure, no IPFS, no Walrus.

### Context

The design spec explicitly states: "Merchant pastes any hosted image URL (Facebook photo, Google Drive, etc.). No file upload infrastructure needed." This is a deliberate product simplicity decision.

### Centralization Analysis

A URL string on-chain is not the same as the content it points to. The blockchain guarantees that the URL string is immutable (once set) and visible to all. It does not guarantee that the content at that URL is available, unchanged, or permanent.

**Failure modes:**

1. **Link rot.** The image host deletes or moves the image. All `StampCard` NFTs that reference this URL render a broken image. `Display` metadata shows a broken image in wallets. This has happened to high-profile NFT collections at scale.

2. **Content substitution.** The image host or the merchant changes the image at the same URL. The URL on-chain is valid; the content is different. For a merchant changing their seasonal logo, this is a feature. For a bad actor pointing the URL at inappropriate content, this is a vulnerability. In practice, the merchant controls their `StampProgram` object (only they can call `update_program`), so the threat is the merchant themselves — not an external attacker. This is acceptable behavior.

3. **CORS restrictions.** Some hosting services (Google Drive, certain CDNs) set CORS headers that block cross-origin image loading in web apps. The Display renderer in Slush wallet may fail to load images from these sources. Facebook CDN URLs in particular are known to be ephemeral and authentication-gated.

### Alternatives Considered

**Option A: IPFS with a pinning service (Pinata, NFT.Storage).**
Content-addressed storage — the URL encodes the content hash. As long as any node pins it, the content is accessible. Requires a file upload UX and a pinning service account. Adds infrastructure and cost. Appropriate for mainnet when merchants care about permanent NFT provenance.

**Option B: SUI Walrus (decentralized storage).**
Walrus is SUI's native decentralized storage protocol, live on mainnet as of 2026. Storing the logo on Walrus and recording the Walrus blob ID on-chain would give content-addressable, SUI-native decentralized storage with no external dependency. This is the architecturally correct long-term choice for Suiki because it keeps the entire stack on SUI infrastructure. Rejected for MVP because it requires integrating the Walrus SDK and a file upload UX.

**Option C: Base64-encoded image stored in the string field.**
Technically possible but prohibited. Move strings on SUI have a size limit. A logo image would exceed it.

### Display Standard Implication

The `image_url` field in the `StampCard` Display template is `{merchant_logo}`, which resolves to whatever URL string is in the field. If the URL is broken, wallets render a blank or broken image. The stamp count description (`{current_stamps}/{stamps_required} stamps collected`) will still render correctly via text fields. The NFT is not non-functional — only the image is affected.

### Consequences

**For MVP:** Acceptable. Merchants will use their Facebook page photo or a direct image upload URL. Guide them to use stable hosting (Imgur, Cloudinary free tier, or direct upload to a CDN). Add this to the merchant onboarding copy.

**For mainnet:** Must migrate to Walrus or a pinning service. The `update_program` function already allows merchants to update `logo_url`, so migration is non-breaking — merchants update their URL to the new content-addressed version.

### Recommendation

Accept for MVP. Add a migration path: in V2, provide a "Upload logo" button in the merchant UI that uploads to Walrus, stores the Walrus blob URL, and calls `update_program` with the new URL. No contract change needed.

Document in the grant application that the MVP uses URL references with a clear migration path to Walrus for mainnet — this demonstrates awareness of the SUI ecosystem and a credible upgrade plan.

---

## ADR-004: No Database in MVP — 100% On-Chain Queries

**Status:** Accepted for MVP with explicit scale ceiling

### Decision

All data reads go through `@mysten/sui` JSON-RPC calls to SUI fullnode. No Supabase, no server-side cache, no indexer. Customer cards and merchant programs are discovered via event queries (`queryEvents`) followed by `multiGetObjects`.

### Query Pattern Analysis

The current query pattern in `queries.ts` is a two-step event scan:

1. `client.queryEvents({ query: { MoveEventType: ... } })` — returns the last page of events by default (50 events, descending).
2. Filter events client-side by `merchant` or `customer` address.
3. `client.multiGetObjects({ ids: [...] })` — fetch the actual object data.

**Critical limitation: event pagination is not implemented.** The `queryEvents` call returns at most one page (50 events by default). If more than 50 `ProgramCreated` events have been emitted globally, `fetchMerchantPrograms` will silently miss older ones. The same applies to `fetchCustomerCards`. For the first 50 merchant programs ever created on the package, this works. At 51+, merchants who created their program early may not see it.

This is an MVP correctness issue, not just a performance concern. It must be fixed before launch, not before mainnet. The fix is straightforward: implement pagination with `cursor` and loop until `hasNextPage === false`. However, for any real scale, scanning all events globally to filter by one address is inefficient.

**Query performance at scale:**

| Programs created globally | `fetchMerchantPrograms` cost |
|---|---|
| 50 | 1 RPC call (one page) |
| 500 | 10 RPC calls (paginate all) |
| 5,000 | 100 RPC calls — timeout risk |
| 50,000 | Unusable without an indexer |

For the MVP cold-start (20 merchants, 200 customers), current approach is fine. The inflection point where performance degrades to unacceptable is approximately 1,000 total programs created on the package.

**`queryEvents` rate limits:** Public SUI fullnodes enforce rate limits on JSON-RPC calls. Sustained heavy use will hit 429 responses. For the MVP demo, using the official Mysten fullnode is fine. For production, provision a dedicated node via Triton One, Chainbase, or BlockEden.

### Alternatives Considered

**Option A: SUI GraphQL API (sui.io/graphql).**
SUI ships a native GraphQL API that supports querying objects by type, filtered by content fields. `getObjects(filter: { type: "0xPKG::suiki::StampCard", owner: { addressOwner: "0x..." } })` would return cards for a customer without event scanning. However, since `StampCard` is a shared object (not owned), `addressOwner` filtering does not apply. A content filter (`{ MoveObject: { type: "0xPKG::suiki::StampCard" } }`) would return all cards globally. This is not better than event scanning for our access pattern.

**Option B: Dynamic fields for indexed lookup.**
Add a `Table<address, ID>` to `StampProgram` mapping customer address to their card ID. Merchants could look up a customer's card directly by calling `dynamic_field::borrow`. This would eliminate the event scan for `findCardForProgram` entirely. The trade-off is increased gas cost per `create_card_and_stamp` (table insertion) and more complex contract code. For the MVP stamp flow (merchant scans customer QR that already contains the card ID), this optimization is unnecessary.

**Option C: Supabase mirror from day one.**
Run a SUI event listener that mirrors `CardCreated`, `StampIssued`, `StampRedeemed`, `ProgramCreated` events to Postgres. All queries hit Postgres. Near-instant response times at any scale. Rejected for MVP because it adds significant infrastructure, operational complexity, and cost for a product that does not yet have users.

### When to Add Supabase

The trigger is not a time milestone — it is a user count milestone. Add the Supabase event mirror when:

- Total programs created exceeds 200 (event pagination adds noticeable latency).
- Any merchant has more than 100 customers (per-merchant card queries become slow).
- Customer page load time for "My Cards" exceeds 2 seconds (user-visible regression).

The gRPC event listener (Laserstream) → Supabase pipeline is already designed in the spec. The implementation can be added as a background service without any contract or frontend changes.

### Consequences

**Correctness risk (high):** Missing pagination in `fetchMerchantPrograms` and `fetchCustomerCards` will cause data loss at >50 global events. Fix before launch.

**Performance ceiling (low for MVP):** Acceptable at <1,000 total records. Known upgrade path exists.

**Operational simplicity (positive):** No database to provision, back up, secure, or maintain for the MVP. Correct for a pre-product-market-fit stage.

### Recommendation

Fix the event pagination issue before testnet launch. Add a `cursor`-based pagination loop to both `fetchMerchantPrograms` and `fetchCustomerCards`. Cap pagination at 500 total results per query to prevent infinite loops.

Then accept the no-database decision for MVP. Add Supabase when user metrics trigger the threshold above.

---

## ADR-005: Move 2024.beta Edition

**Status:** Accepted — risk is low, not zero

### Decision

`Move.toml` specifies `edition = "2024.beta"`. The contract uses 2024 syntax: `public struct` (not `struct`), method-style calls (`program.merchant`, `ctx.sender()`), vector literals, and `has key` without explicit `has store` on some objects.

### What "2024.beta" Means

The `2024.beta` edition in SUI Move enables the 2024 language features. As of early 2026, the 2024 edition features are:

- Method syntax (`obj.field`, `ctx.method()`)
- `public struct` keyword (structs are private by default without `public`)
- Enum types
- Dot-notation for function calls on values (`string.length()` etc.)
- Improved pattern matching

The "beta" designation means the edition syntax and semantics may change before a stable `2024` release. In practice, Mysten Labs has been conservative about breaking published contracts — once a package is deployed, the on-chain bytecode is what was compiled. The edition only matters for recompilation.

**Risk assessment:**
- If the `2024.beta` edition syntax changes, the source code in the repo may not recompile correctly against a future compiler version.
- The deployed bytecode on mainnet is unaffected by compiler changes.
- The risk is to the development workflow (future upgrades, audit tooling) rather than to live deployed contracts.

**Current compiler version:** The SUI CLI ships the Move compiler. As of March 2026, the SUI testnet framework is at `framework/testnet` rev. This matches the `Move.toml` dependency. The beta edition has been stable in practice since mid-2025.

### Alternatives Considered

**Option A: Use legacy edition (no edition field, or `edition = "legacy"`).**
Reverts to the classic Move syntax (`struct` instead of `public struct`, no method calls, explicit `use` for all vector operations). This is fully stable and used by most production contracts deployed before 2025. Would require rewriting the contract to not use method-call syntax. Rejected — the 2024 syntax is cleaner and Mysten's own examples all use it.

**Option B: Wait for stable `2024` edition.**
The 2024 stable edition release date is not publicly confirmed. Waiting introduces project delay. Rejected for MVP.

### Consequences

**Low risk:** The specific features used in the Suiki contract (method-style field access, `public struct`) have been stable for over a year in `2024.beta`. The probability of a breaking compiler change before mainnet is low.

**Audit tooling:** Some Move auditors' toolchains may not fully support `2024.beta`. Confirm with the chosen auditor that their toolchain supports the edition before booking the audit.

**Upgrade path:** If the edition graduates to `2024` stable, update `Move.toml` and recompile. No on-chain changes required.

### Recommendation

Accept. The edition choice is consistent with current SUI developer best practices. Confirm compiler version compatibility with the audit firm before the security audit engagement.

---

## ADR-006: StampCard Display Metadata Staleness

**Status:** Accepted — behavior is a product feature, not a bug, for most cases. One case requires a contract change.

### Decision

`StampCard` stores a snapshot of `merchant_name` and `merchant_logo` at the time the card is created (copied from `StampProgram` during `create_card_and_stamp`). The `Display` template fields `{merchant_name}` and `{merchant_logo}` resolve to these cached values on the card object.

When a merchant calls `update_program` to change their logo URL, the `StampProgram.logo_url` field is updated. But every existing `StampCard` still holds the old `merchant_logo` value from when the card was created.

### The Design Spec's Claimed Behavior vs. Reality

The design spec states:

> "When the merchant updates their program (new logo URL, seasonal design, new branding) — all StampCard NFTs for that merchant visually update automatically without re-minting."

**This is incorrect as currently implemented.** The Display template renders `{merchant_logo}` from the `StampCard` object's field, not from the `StampProgram`. Since `merchant_logo` is a copied field on each `StampCard`, it does not update when `StampProgram.logo_url` changes.

To achieve what the spec describes, the Display template's `image_url` must reference a field that dynamically resolves against the `StampProgram` — which Display templates cannot do. Display templates can only reference fields on the object itself.

### Two Distinct Behaviors

**Behavior A (current implementation): Cached snapshot.**
Each `StampCard` shows the logo that was active when the card was created. A merchant's Christmas logo only appears on cards created in December. Cards created in January still show the old logo. This is not what the spec promises.

**Behavior B (alternative): Live reference.**
The Display `image_url` always shows the current merchant logo. Achieving this requires removing `merchant_logo` from `StampCard` and instead routing the Display image through a server that fetches the current `StampProgram.logo_url` on demand.

**Implementation of Behavior B:**
Change the Display `image_url` field from `{merchant_logo}` to a dynamic URL:
```
https://suiki.app/api/card-image/{id}
```
This API route reads the card's `program_id` from the chain, fetches the corresponding `StampProgram.logo_url`, and either redirects to it or renders a composed image (logo + stamp count). This adds server infrastructure but gives true live updates.

The alternative Display template entry would be:
```
image_url: "https://suiki.app/api/card-image/{id}"
```
Where `{id}` is the object ID of the `StampCard`, resolved at render time by the wallet calling the API.

### Consequences of Current Implementation

**For MVP:** The cached behavior is actually acceptable. The card shows the logo at creation time. Merchants are unlikely to change their logo during the MVP period. The broken claim in the spec is a documentation issue, not a shipping blocker.

**For grant application:** Do not claim automatic visual update in the grant narrative. Either fix the implementation to deliver Behavior B, or describe the cached behavior accurately. Grant reviewers with Move expertise will identify the discrepancy.

**For `stamps_required` changes:** There is a second staleness issue. `StampCard.stamps_required` is also copied at creation time. If a merchant later raises or lowers the required stamp count via `update_program`, existing cards still show the old threshold. Customers who collected stamps under the old threshold need to be handled. **`update_program` currently does not update `stamps_required`.** This is correct behavior — changing the threshold mid-card would be unfair to customers. But it means the threshold is effectively immutable per card, not per program. This is a product decision that must be made explicit.

### Recommendation

**Short term (pre-mainnet):** Remove the incorrect claim from the design spec. Document the actual behavior: "Logo and stamp threshold are set at card creation time. Merchants can update their program; new cards will reflect the update. Existing cards keep the values from when they were issued."

**For live updates (V2):** Implement the server-side card image API (`/api/card-image/[id]`) that fetches current program data and composes the card image dynamically. Update the Display template to use this URL. This requires a contract upgrade (changing the `display::new_with_fields` template) via a publisher capability call, or deploying a new Display object via the publisher.

**For the grant demo:** The cached behavior is fine. For the seasonal redesign use case described in the spec, it does not work as written. Remove that example from the spec or implement Behavior B before using it in the demo.

---

## Open Questions Before Mainnet

These are unresolved decisions that must be answered before a mainnet launch. They are not blocking for testnet or the grant demo.

### Q1: Smart contract upgradability strategy

The current contract has no upgrade policy set. SUI packages can be deployed with three upgrade policies: `compatible`, `additive`, or `immutable`. Setting no policy defaults to the deployer being able to upgrade arbitrarily.

For a loyalty app where customers trust that their stamp counts cannot be erased, an `immutable` policy or a `compatible`-only policy with a timelock would strengthen user trust. Decide and document the upgrade policy before mainnet. **Recommendation:** Deploy with `compatible` upgrades only (new public functions allowed; existing function signatures and struct fields immutable). This allows adding features without breaking existing integrations.

### Q2: Rate limiting enforcement mechanism

The sponsor API rate limit (50 tx/merchant/day) is described in the spec but not implemented. Before mainnet, decide: in-memory counter (lost on cold start, not suitable for serverless), Upstash Redis (recommended), or Supabase. This must be implemented before mainnet sponsorship is enabled.

### Q3: Sponsor key custody for mainnet

The current approach (private key in Vercel env var) is not enterprise-grade key custody. For a production service handling real user value, evaluate: AWS KMS, HashiCorp Vault, or switching to Enoki/Shinami for managed sponsorship. The decision affects the operational security posture of the mainnet deployment.

### Q4: Event pagination implementation

`fetchMerchantPrograms` and `fetchCustomerCards` do not paginate event results. This causes silent data loss beyond 50 records. Must be fixed before launch, not just before mainnet.

### Q5: StampCard wallet visibility

Shared objects do not appear in `getOwnedObjects`. Customers cannot see their stamp cards in Slush's native NFT view. For the MVP, the Suiki PWA is the only interface. Post-MVP, evaluate whether a kiosk-wrapped approach can solve this without redesigning the object model. This should be investigated before the grant demo if wallet-native rendering is part of the pitch narrative.

### Q6: Redemption confirmation flow

The current `redeem` function is callable by the customer alone — the merchant is not required to co-sign. A customer can redeem at home without merchant awareness. This may be intentional (trustless self-redemption) or a product bug (merchant needs to know to give the physical reward). The product spec does not resolve this. Decide and implement accordingly:

- **Trustless:** Keep current behavior. Redemption is on-chain. Merchant queries `StampRedeemed` events to see who has redeemed.
- **Merchant-confirmed:** Add a `merchant: address` parameter to `redeem` and require `program.merchant == ctx.sender()`, with the customer present via QR scan. This requires a two-party transaction.

The two-party redemption is architecturally more complex (requires the customer and merchant to be in the same location or use a time-locked claim flow) but better models the physical loyalty card experience.

### Q7: Contract audit vendor

No Move audit vendor is selected. Before mainnet with real users, a security audit is mandatory. The known reputable Move auditors as of 2026 are OtterSec, Movebit, and Halborn. Confirm their `2024.beta` edition support. Budget ₱150,000–₱400,000 for a full audit of the current contract scope.

---

*CTO Review written: 2026-03-25*
*Review covers: Design Spec v1, Implementation Plan v1 (Tasks 1–7)*
*Next review: After testnet launch and first 20-merchant pilot*
