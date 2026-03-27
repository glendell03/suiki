# Suiki Smart Contract V2 — Architecture & Extensibility Design

**Date:** 2026-03-27
**Status:** Final Draft — Walrus research complete (2026-03-28)
**Scope:** Move contract redesign for mainnet — metadata extensibility, security hardening, scalability, multi-location support
**Author:** Brainstorming session (Claude + glendell)

---

## 1. Problem Statement

The current `suiki.move` contract is pre-mainnet and functional, but has three structural limitations that will block growth:

1. **Struct layouts are frozen at deploy time.** No Sui upgrade policy allows adding fields to existing structs. Any new data requirement after mainnet requires a workaround.
2. **Display metadata is stored redundantly on every card.** `merchant_name`, `merchant_logo`, `reward_description` are copied to each `StampCard` — bloating storage and creating staleness problems.
3. **Single-merchant-wallet assumption.** The `ENotMerchant` guard checks `ctx.sender() == program.merchant` — no way for branch staff with separate wallets to stamp cards.

### Core Principle for V2

> Keep the struct as the **minimal hardened core** — only fields that are checked in `assert!()` guards every transaction. Everything else lives in dynamic fields (extensible, permanent, on-chain) or Walrus (rich content, images, large text).

---

## 2. The Invariant Test (Decision Framework)

For every field, ask:

| Question | Put it here |
|---|---|
| Checked in an `assert!()` guard every transaction? | **Struct field** |
| On-chain truth but accessed rarely or may grow? | **Dynamic field** |
| Display content, large text, or binary assets? | **Walrus blob** |
| Behavioral/sensitive data subject to PDPA? | **Off-chain only (Supabase, encrypted)** |

---

## 3. Object Architecture Redesign

### 3.1 `StampProgram` — Struct (Hardened Core)

Only fields checked in transaction guards:

```move
public struct StampProgram has key {
    id: UID,
    merchant: address,       // ENotMerchant guard
    stamps_required: u64,    // ENotEnoughStamps — checked at redeem
    is_active: bool,         // gates issue_stamp + create_card_and_stamp
}
```

**Removed from struct:**
- `name` → Walrus blob (display only)
- `logo_url` → Walrus blob (display only)
- `reward_description` → Walrus blob (display only)
- `theme_id` → dynamic field (not in any guard)
- `total_issued` → **dropped entirely** (kills shared object throughput; rebuild from `StampIssued` events)

**`is_active` lifecycle states (program status as u8 dynamic field):**
```
0 = active      → accepts new cards + new stamps
1 = draining    → no new cards; existing customers can still earn + redeem
2 = closed      → no new activity; historical read only
```
Using a `u8` instead of `bool` allows future states without a contract upgrade.

---

### 3.2 `StampProgram` — Dynamic Fields

Added post-deploy without struct changes:

| Key (String) | Type | Purpose |
|---|---|---|
| `"theme_id"` | `u8` | Visual theme; 0–5 free, 6–63 premium |
| `"metadata_blob_id"` | `String` | Walrus blob ID → JSON with name, logo, description |
| `"stamp_cooldown_ms"` | `u64` | Min ms between stamps per card (anti-abuse) |
| `"max_stamps_per_day"` | `u64` | Max stamps merchant can issue per card per day |
| `"expiry_days"` | `u64` | Stamps expire after N days of inactivity (0 = no expiry) |
| `"tier_thresholds"` | `vector<u64>` | e.g. `[10, 25, 50]` total_earned for bronze/silver/gold |
| `"reward_catalog_id"` | `ID` | Points to `RewardCatalog` object (multi-reward V3) |
| `"program_status"` | `u8` | 0=active, 1=draining, 2=closed |
| `"total_active_cards"` | `u64` | Maintained off-chain via events; set here as a mirror |

---

### 3.3 `StampCard` — Struct (Hardened Core)

```move
public struct StampCard has key {
    id: UID,
    program_id: ID,          // EProgramMismatch guard
    customer: address,       // ENotCustomer guard
    current_stamps: u64,     // ENotEnoughStamps guard
    stamps_required: u64,    // snapshot — see Section 5 for update policy
}
```

**Removed from struct:**
- `merchant_name` → Walrus blob (display only — fetched via program's blob)
- `merchant_logo` → Walrus blob (display only)
- `total_earned` → dynamic field (analytics only, not in any guard)
- `last_stamped` → dynamic field (used for cooldown checks but not current guards)

---

### 3.4 `StampCard` — Dynamic Fields

| Key | Type | Purpose |
|---|---|---|
| `"total_earned"` | `u64` | Completed redemption cycles (analytics) |
| `"last_stamped"` | `u64` | Timestamp for cooldown enforcement |
| `"tier_level"` | `u8` | 0=none, 1=bronze, 2=silver, 3=gold — updated on redeem |
| `"stamps_expire_at"` | `u64` | Epoch ms when current stamps expire (0 = no expiry) |
| `"referral_code"` | `String` | Customer's referral code for V2 referral mechanic |
| `"card_note_blob_id"` | `String` | Walrus blob ID → encrypted merchant note (VIP, allergies) |

---

### 3.5 `MerchantProfile` — Struct (Unchanged Core)

```move
public struct MerchantProfile has key {
    id: UID,
    merchant: address,
    unlocked_themes: u64,    // bitmask — checked in set_premium_theme
}
```

**New dynamic fields:**

| Key | Type | Purpose |
|---|---|---|
| `"verified"` | `bool` | KYC-verified badge (set by AdminCap) |
| `"subscription_tier"` | `u8` | 0=free, 1=pro, 2=enterprise |
| `"max_programs"` | `u8` | Enforced program limit per tier |
| `"profile_blob_id"` | `String` | Walrus blob → display name, bio, category, social links |
| `"total_programs"` | `u8` | Running count; gated by max_programs |

---

### 3.6 `StafferCap` — New Object

```move
/// Owned object. Merchant creates and transfers to branch staff wallet.
/// Holder can call issue_stamp() on behalf of the merchant.
/// Revoke by calling revoke_staffer_cap() — burns the object.
public struct StafferCap has key {
    id: UID,
    program_id: ID,          // bound to a specific program
    merchant: address,       // issuing merchant — anti-forgery
    staffer: address,        // who holds this cap
}
```

**Design rationale:**
- Owned object = no shared state = zero consensus contention
- O(1) authorization check (not a vector scan)
- Revocation is instant: burn the object
- Bound to one program → a franchisee cannot use their cap on a different merchant's program

---

### 3.7 `AdminCap` — New Object (Platform Admin)

```move
/// Singleton owned by the Suiki platform deployer.
/// Used to set verified flag, adjust subscription tiers, emergency pause.
public struct AdminCap has key, store {
    id: UID,
}
```

Created in `init()`, transferred to deployer. Required for:
- `set_verified(profile, admin_cap)` — KYC verification
- `emergency_pause(program, admin_cap)` — platform-level intervention

---

## 4. Walrus Blob Structure

### 4.1 Program Metadata Blob (JSON)

Stored on Walrus. Blob ID saved as `"metadata_blob_id"` dynamic field on `StampProgram`.

```json
{
  "version": 1,
  "name": "Aling Rosa's Tapsihan",
  "logo_url": "walrus://<image_blob_id>",
  "reward_description": "Free Tapsilog after 10 stamps",
  "category": "food",
  "tags": ["breakfast", "Filipino", "tapsihan"],
  "locations": [
    { "name": "Main Branch", "address": "Barangay 7, Caloocan" },
    { "name": "SM Branch", "address": "SM City North EDSA" }
  ],
  "terms_and_conditions": "Valid Mon–Sat. One reward per day.",
  "social": {
    "facebook": "https://fb.com/alingrosas",
    "instagram": "@alingrosas"
  },
  "updated_at": 1743033600000
}
```

### 4.2 Merchant Profile Blob (JSON)

```json
{
  "version": 1,
  "display_name": "Rosa dela Cruz",
  "bio": "Family-owned tapsihan since 1995.",
  "category": "food",
  "cover_image_blob_id": "<walrus_blob_id>",
  "social": { "facebook": "...", "instagram": "..." }
}
```

### 4.3 Card Note Blob (JSON, Encrypted)

Merchant-written notes on a customer card. **Encrypted with merchant's key before upload.**

```json
{
  "version": 1,
  "note": "Regular VIP. Suki since 2024.",
  "flags": ["vip", "allergy:shellfish"],
  "encrypted": true,
  "encryption_key_hint": "merchant_pub_key_fingerprint"
}
```

---

## 5. Walrus Storage Strategy

### 5.1 Confirmed Facts (Research complete: 2026-03-28)

| Fact | Status |
|---|---|
| Walrus mainnet is live (launched March 27, 2025) | ✅ Confirmed |
| Storage is epoch-based — no true "permanent" option exists | ✅ Confirmed |
| Max epochs per single booking: **~52 epochs ≈ 2 years** on mainnet | ✅ Confirmed |
| `system::extend_blob` is callable from Move smart contracts | ✅ Confirmed |
| WAL token used for payment (storage fees) and staking (node security) | ✅ Confirmed |
| 1 WAL = 1,000,000,000 FROST; max supply 5B WAL | ✅ Confirmed |
| **64 MB metadata floor per blob** — small files are wasteful individually | ✅ Confirmed |
| Quilt batched uploads avoid the 64 MB floor — use for small JSON files | ✅ Confirmed |
| SDK: `@mysten/walrus` package with `SuiGrpcClient` — matches our stack | ✅ Confirmed |
| Upload relay reduces ~2,200 node requests → 1 HTTP call | ✅ Confirmed |
| Expired blobs can be re-uploaded if you kept a local copy (same Blob ID) | ✅ Confirmed |
| Used in production by Pudgy Penguins, TradePort, 120+ projects | ✅ Confirmed |

### 5.2 The Permanence Problem

**There is no "pay once, store forever" option in Walrus.** Blobs are epoch-bound and require renewal. The WAL staking model pays node operators per epoch but does not create a protocol-level endowment for individual blobs.

**The implication:** Walrus alone cannot be trusted for long-term loyalty data without an operational renewal system. Data that must survive indefinitely must be stored on-chain (dynamic fields) or on Arweave.

### 5.3 The 64 MB Floor — Critical Cost Trap

Every individual blob has a **64 MB metadata floor** — even a 1 KB JSON file costs the same as a 64 MB file in storage fees. Storing one metadata JSON per merchant wastes 63.999 MB of paid storage per merchant.

**Fix: Quilt batched uploads.** Walrus Quilt groups multiple small files into one blob, amortizing the metadata floor across all files. For Suiki with 1,000 merchants, each storing a ~2 KB JSON metadata blob:

```
Individual uploads: 1,000 merchants × 64 MB floor = 64,000 MB billed
Quilt batch upload: 1,000 × 2 KB = ~2 MB actual + 1 × 64 MB floor = ~66 MB billed

Cost saving: ~99.9% reduction in storage cost
```

**Architecture implication:** The backend must batch merchant metadata updates into periodic Quilt uploads rather than uploading one blob per save action. This adds design complexity but is non-negotiable for cost efficiency at scale.

### 5.4 What Walrus IS Good For (Even Without Permanence)

Walrus is excellent for content where **temporary unavailability is acceptable** — images, branding, rich text. If a merchant's logo disappears for a week during renewal, customers see a placeholder. The stamp record and all business logic remain unaffected on-chain.

### 5.5 Auto-Renewal Architecture (Recommended for Mainnet)

The `system::extend_blob` Move function is callable from smart contracts AND from a TypeScript backend using `@mysten/walrus`. The full architecture:

```
Supabase table:
  walrus_blobs { blob_id, sui_object_id, program_id, expires_epoch, type, last_renewed_at }

Vercel Cron (weekly):
  1. Query blobs where expires_epoch < current_epoch + 4
  2. For each: call walrus SDK extend (uses sui_object_id, not blob_id)
  3. Update expires_epoch in Supabase
  4. Alert Slack if treasury WAL balance < 60-day runway

Treasury wallet:
  Holds WAL tokens for renewals
  Top-up from protocol revenue (theme purchases, Pro subscription fees)
```

**On-chain renewal option (bonus):** A Move function `merchant_renew_blob(program, payment: Coin<WAL>)` lets merchants self-renew their own blobs directly, removing platform dependency.

**Extend requires the Sui object ID** (not the Blob ID):
```typescript
// Extend a blob using @mysten/walrus SDK
await client.walrus.extend({
  blobObjectId: '0x1c086e...', // Sui object ID, NOT the content-addressed Blob ID
  epochsExtended: 52,          // extend by ~2 more years
  signer: treasuryKeypair,
});
```

### 5.6 Arweave for Truly Permanent Content (Belt + Suspenders)

For terms & conditions and legal text — upload to Arweave (pay-once permanent) AND reference it inside the Walrus blob. Even if the Walrus blob is renewed many times, the Arweave reference is an immutable audit trail.

```json
{
  "version": 1,
  "name": "Aling Rosa's Tapsihan",
  "terms_and_conditions": "Valid Mon–Sat only. One reward per day.",
  "terms_arweave_id": "arweave://Qm...",
  "logo_blob_id": "<walrus_blob_id>"
}
```

**Arweave vs Walrus cost crossover:** Walrus is cheaper for < 3 years; Arweave wins at 3+ year horizon. For Suiki's legal text (must survive forever), Arweave is the right call.

### 5.7 TypeScript SDK Integration (Matches Existing Stack)

`@mysten/walrus` extends `SuiGrpcClient` — this is already the client in `src/lib/sui-client.ts`. Zero new infrastructure.

```typescript
// src/lib/walrus-client.ts (new server-only file)
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';
import { WalrusFile } from '@mysten/walrus';

export const walrusClient = new SuiGrpcClient({
  network: process.env.NEXT_PUBLIC_SUI_NETWORK,
}).$extend(
  walrus({
    uploadRelay: {
      host: 'https://upload-relay.mainnet.walrus.space',
      sendTip: { max: 1_000 },
    },
  }),
);

// Upload merchant metadata (always use Quilt for small files)
export async function uploadMerchantMetadata(
  metadataFiles: Array<{ programId: string; json: object }>,
): Promise<Map<string, string>> {
  const files = metadataFiles.map(({ programId, json }) =>
    WalrusFile.from({
      contents: new TextEncoder().encode(JSON.stringify(json)),
      identifier: `${programId}.json`,
      tags: { 'content-type': 'application/json' },
    }),
  );

  const results = await walrusClient.walrus.writeFiles({
    files,           // Quilt batches automatically when multiple files provided
    epochs: 52,      // ~2 years on mainnet
    deletable: false,
    signer: sponsorKeypair,
  });

  return new Map(results.map((r, i) => [metadataFiles[i].programId, r.blobId]));
}
```

### 5.8 Recommended Storage Tiering for Suiki (Final)

| Content | Storage | Durability | Notes |
|---|---|---|---|
| Stamp counts, access control | Struct | Permanent (Sui) | Core invariants |
| Program name, reward description, category | Dynamic fields | Permanent (Sui) | Small strings; Display-critical |
| Logo image, card visuals | Walrus Quilt + auto-renewal | Long-term with ops | Brief unavailability acceptable |
| Merchant bio, social links, locations | Walrus Quilt + auto-renewal | Long-term with ops | Non-critical if briefly unavailable |
| Terms & conditions | Walrus + Arweave | Permanent (Arweave) | Legal; must survive forever |
| Card notes (encrypted, merchant-written) | Walrus + auto-renewal | Long-term with ops | Sensitive; encrypt before upload |
| Behavioral analytics, visit timestamps | **Supabase only** | Controlled | PDPA; right to erasure required |

### 5.9 Revised Field Allocation

Fields moved from Walrus → Dynamic Fields after confirming no true permanence:

| Field | Revised Plan | Reason |
|---|---|---|
| `name` | **Dynamic field** | Display-critical; NFT broken if Walrus blob expires |
| `reward_description` | **Dynamic field** | Shown to customer; must always be available |
| `category` | **Dynamic field** | Needed for on-chain discovery/indexing |
| `logo_blob_id` | Walrus (acceptable) | Visual only; placeholder shown if unavailable |
| `terms_and_conditions` | Walrus + Arweave | Legal requirement; Arweave provides permanence |
| `locations`, `bio`, `social` | Walrus Quilt | Rich content; non-critical |

This way, even if the Walrus blob temporarily expires, the core Display fields (`name`, `reward_description`) still render correctly from on-chain dynamic fields.

---

## 6. `stamps_required` Snapshot Policy

### Decision: Keep snapshot on card. Enforce one-way update rule.

**Rationale:** The snapshot is the *contract with the customer* — they started collecting under those terms. Raising the bar mid-journey is anti-consumer and damages trust.

**Enforcement in `sync_card_metadata`:**

```move
// Only allow syncing if new threshold is lower or equal (benefit to customer)
// Raising threshold on existing cards is blocked — create new cards instead
assert!(program.stamps_required <= card.stamps_required, ECannotRaiseThreshold);
```

| Scenario | Behavior |
|---|---|
| Merchant lowers 10 → 7 | `sync_card_metadata` pushes 7 to existing cards ✓ |
| Merchant raises 7 → 10 | `sync_card_metadata` aborts with `ECannotRaiseThreshold` ✗ |
| Merchant raises 7 → 10 | New cards created after update get threshold 10 ✓ |

---

## 7. Program Lifecycle (`is_active` / status)

```
create_program → status: active (0)
                    ↓
          deactivate_program → status: draining (1)
          (no new cards, no new stamps; existing cards can still redeem)
                    ↓
          close_program → status: closed (2)
          (fully closed; read-only)
```

**Function guards:**
- `create_card_and_stamp` — requires `status == 0`
- `issue_stamp` — requires `status == 0`
- `redeem` — requires `status == 0 OR 1` (customers can drain during wind-down)

**New error codes:**
```move
const EProgramNotActive: u64 = 12;
const EProgramDraining: u64 = 13;
```

---

## 8. Multi-Location Stamping (StafferCap Pattern)

### New Functions

```move
/// Merchant creates a StafferCap for a branch staff wallet.
public fun create_staffer_cap(
    program: &StampProgram,
    staffer: address,
    ctx: &mut TxContext,
): StafferCap

/// Merchant burns a StafferCap to revoke access.
public fun revoke_staffer_cap(
    cap: StafferCap,
    ctx: &TxContext,
)

/// Staff member issues a stamp using their StafferCap.
/// Same logic as issue_stamp but authorized via cap instead of merchant address check.
public fun staff_issue_stamp(
    cap: &StafferCap,
    program: &StampProgram,
    card: &mut StampCard,
    clock: &Clock,
    ctx: &TxContext,
)
```

### Authorization logic in `staff_issue_stamp`

```move
assert!(cap.program_id == object::id(program), EProgramMismatch);
assert!(cap.merchant == program.merchant, ENotMerchant);
assert!(cap.staffer == ctx.sender(), ENotStaffer);
assert!(program.is_active, EProgramNotActive);
```

### Edge Cases

| Scenario | Behavior |
|---|---|
| Staff wallet compromised | Merchant calls `revoke_staffer_cap` — burns the object |
| Staff leaves job | Same — burn the cap |
| Merchant transfers program to new owner | Old `StafferCap` objects become invalid (cap.merchant ≠ new program.merchant) — all caps invalidated automatically |
| Merchant tries to use own staffer cap | Works — merchant can create a cap for themselves if needed |

---

## 9. New Error Codes

```move
const ECannotRaiseThreshold: u64 = 12;
const EProgramNotActive: u64 = 13;
const EProgramDraining: u64 = 14;
const ENotStaffer: u64 = 15;
const EStafferCapMismatch: u64 = 16;
const EStampCooldown: u64 = 17;
const EMaxStampsPerDayReached: u64 = 18;
```

---

## 10. New Events

```move
public struct ProgramStatusChanged has copy, drop {
    program_id: ID,
    merchant: address,
    old_status: u8,
    new_status: u8,
}

public struct StafferCapCreated has copy, drop {
    cap_id: ID,
    program_id: ID,
    merchant: address,
    staffer: address,
}

public struct StafferCapRevoked has copy, drop {
    program_id: ID,
    merchant: address,
    staffer: address,
}

public struct MetadataBlobUpdated has copy, drop {
    program_id: ID,
    merchant: address,
    blob_id: String,
}

public struct TierUpgraded has copy, drop {
    card_id: ID,
    customer: address,
    old_tier: u8,
    new_tier: u8,
}
```

---

## 11. Security Improvements (from Security Audit)

### Remaining Open Findings Addressed in V2

| Finding | V2 Fix |
|---|---|
| FIND-03: `total_issued` shared contention | Dropped from struct; rebuild from events |
| FIND-13: No pause/close mechanism | `program_status` dynamic field + lifecycle functions |
| FIND-14: No card recovery | `merchant_reassign_card(program, card, new_customer)` — merchant-only |

### New Security Patterns

**Stamp cooldown enforcement (anti-double-stamp):**
```move
// In issue_stamp / staff_issue_stamp:
if df::exists_(&card.id, b"stamp_cooldown_ms") {
    let cooldown = df::borrow<vector<u8>, u64>(&card.id, b"stamp_cooldown_ms");
    let last = df::borrow_or_default<vector<u8>, u64>(&card.id, b"last_stamped", 0);
    assert!(clock.timestamp_ms() - last >= *cooldown, EStampCooldown);
}
```

**Daily stamp cap:**
```move
// Track stamps issued today per card via dynamic field keyed on date
// Key: b"stamps_today:<epoch_day>" Value: u64 count
```

---

## 12. Upgrade Policy Decision

**Recommendation: Deploy with `compatible` upgrade policy.**

Reasoning:
- `immutable` — permanently locks the contract. If a critical security bug is found, no fix possible. Too risky for a loyalty app with real user data.
- `compatible` — allows adding new `public` functions and changing function bodies. Cannot change existing public function signatures or struct layouts. This is the right balance.
- `additive` — more restrictive than `compatible`. Disallows changing existing function bodies. Too limiting for bug fixes.

```toml
# Move.toml — set before mainnet publish
[package]
upgrade-policy = "compatible"
```

After confirming the contract is stable (6+ months on mainnet, security audit passed), consider calling `only_dep_upgrades()` or `make_immutable()` to signal long-term commitment to users.

---

## 13. Display Standard Update

### Current Problem (ADR-006)

`image_url` in the Display template is `{merchant_logo}` — a field copied to the card at creation. Logo changes don't propagate. Also the card image is a plain logo, not a composed stamp-card visual.

### V2 Approach: Server-Rendered Card Image

Change the Display `image_url` to a server-rendered endpoint:

```
image_url: "https://suiki.app/api/card-image/{id}"
```

The `/api/card-image/[cardId]` route:
1. Fetches the `StampCard` object (program_id, current_stamps, stamps_required)
2. Fetches the `StampProgram`'s `metadata_blob_id` dynamic field
3. Reads the Walrus blob → gets name, logo_url
4. Renders and returns a composed PNG (logo + stamp grid + merchant name)

**Benefits:**
- Card image always shows current stamps (live)
- Always shows current merchant branding
- Custom stamp grid visual instead of plain logo
- Wallet-native NFT rendering works correctly

**Trade-off:** Adds server dependency for NFT display. If Suiki's API is down, wallet shows blank image. Mitigate with a CDN cache layer (Cloudflare, Vercel Edge).

This requires a Display object update (not a contract upgrade) — call via publisher capability.

---

## 14. Data Sensitivity Matrix (PDPA)

| Data | Location | Sensitivity | PDPA Risk | Mitigation |
|---|---|---|---|---|
| `customer: address` | On-chain struct | Medium | Pseudonymous but linkable | Disclose in ToS before wallet connect |
| `current_stamps` | On-chain struct | Low | Non-personal | None needed |
| `last_stamped` timestamps | Dynamic field | Medium | Reveals visit patterns | Don't mirror raw to Supabase; aggregate only |
| `total_earned` | Dynamic field | Low | Loyalty history | Fine on-chain |
| Card notes | Walrus (encrypted) | **High** | Contains PII (name, allergies) | Encrypt before upload; merchant holds key |
| Merchant name / address | Walrus blob | Low | Public business info | Fine |
| Analytics events | Supabase | Medium | Visit frequency per wallet | Store as aggregates; HMAC-hash wallet addresses |

---

## 15. Open Questions (Decide Before Implementation)

1. **Walrus permanent storage GA status** — Is WAL token endowment model available on mainnet? Confirm at docs.wal.app. If not GA, implement auto-renewal cron first.

2. **Card note encryption scheme** — Use merchant's Sui keypair (Ed25519) or a separate encryption key? Ed25519 is already present (wallet key) but mixing signing and encryption keys is not best practice.

3. **Tier computation** — Is tier computed on-chain at redeem time (gas cost per redeem) or off-chain and written back by the merchant via a separate tx? Recommend on-chain for tamper-proof tier status.

4. **Referral mechanic design** — What triggers a referral reward? Needs product spec before contract design.

5. **RewardCatalog object design** — For multi-reward programs (V3), what is the structure? Defer to V3 spec.

---

## 16. Migration Path (MVP Contract → V2 Contract)

Since this is pre-mainnet, migration is clean — no live data to migrate.

**Deploy sequence:**
1. Publish V2 contract to testnet
2. Run full test suite including dynamic field operations
3. Security audit (OtterSec / Movebit) — target 4 weeks after code freeze
4. Deploy to mainnet with `compatible` upgrade policy
5. Initialize `AdminCap`, `Publisher`, `Display` objects
6. Update `.env.local` with new `NEXT_PUBLIC_PACKAGE_ID`
7. Update frontend to use new Display image URL pattern

---

## 17. Summary: Field Allocation Table

### StampProgram

| Field | V1 Location | V2 Location |
|---|---|---|
| `id` | struct | struct |
| `merchant` | struct | struct |
| `stamps_required` | struct | struct |
| `is_active` | missing | **struct** (new) |
| `name` | struct | **dynamic field** ← was Walrus, revised (Section 5.7) |
| `reward_description` | struct | **dynamic field** ← was Walrus, revised (Section 5.7) |
| `category` | missing | **dynamic field** (new) |
| `logo_url` | struct | **Walrus blob** (with auto-renewal) |
| `theme_id` | struct | **dynamic field** |
| `total_issued` | struct | **dropped** |
| `metadata_blob_id` | missing | **dynamic field** → full rich content on Walrus |
| `program_status` | missing | **dynamic field** (new) |
| `stamp_cooldown_ms` | missing | **dynamic field** (new) |
| `tier_thresholds` | missing | **dynamic field** (new) |

### StampCard

| Field | V1 Location | V2 Location |
|---|---|---|
| `id` | struct | struct |
| `program_id` | struct | struct |
| `customer` | struct | struct |
| `current_stamps` | struct | struct |
| `stamps_required` | struct | struct |
| `merchant_name` | struct | **Walrus blob** (via program) |
| `merchant_logo` | struct | **Walrus blob** (via program) |
| `total_earned` | struct | **dynamic field** |
| `last_stamped` | struct | **dynamic field** |
| `tier_level` | missing | **dynamic field** (new) |
| `stamps_expire_at` | missing | **dynamic field** (new) |

### MerchantProfile

| Field | V1 Location | V2 Location |
|---|---|---|
| `id` | struct | struct |
| `merchant` | struct | struct |
| `unlocked_themes` | struct | struct |
| `verified` | missing | **dynamic field** (new) |
| `subscription_tier` | missing | **dynamic field** (new) |
| `profile_blob_id` | missing | **dynamic field** (new) |

---

*Spec written: 2026-03-27*
*Next step: Walrus permanent storage research → finalize Section 5 → invoke writing-plans skill*
