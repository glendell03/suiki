# Suiki V3 — Data Architecture & Smart Contract Redesign

**Date:** 2026-03-28
**Authors:** Architect (AI-assisted)
**Status:** Approved — implementation ready
**Replaces:** All previous spec files (v2-design, ui-refactor-design, v2-full-revamp-design)

---

## 1. Guiding Principles

1. **On-chain = ownership proofs + trust boundaries.** Only data that _must_ be trustless, verifiable, or asset-bearing lives in the contract. Everything else belongs off-chain.
2. **Off-chain = operational data + UX details.** Neon Postgres holds all descriptive, mutable, searchable metadata. It is synced from chain events; the chain is the source of truth for balances and ownership.
3. **Long-term extensibility via dynamic fields.** Move struct fields are frozen at deploy. We use `sui::dynamic_field` for every attribute we might need to add in a future upgrade cycle — without breaking the upgrade policy.
4. **Compatible upgrade policy only.** All packages are published with `compatible` upgrade policy. No field removals, no capability drops post-deploy.
5. **PDPA compliance by design.** PII (name, email, phone, address) lives only in Neon Postgres with proper encryption at rest and a deletion path. Nothing irreversible is stored on-chain that could contain PII.
6. **Sui object ID is the universal cross-system key.** Every Sui object already has a globally unique `id: UID`. Postgres rows store `sui_object_id TEXT` pointing to it. No separate `db_id` field is needed on the contract — the chain event emits the object ID immediately on creation, and the indexer uses it to create the Postgres row. This is the pattern used by Gods Unchained, loyalty-chain, and all production Sui/EVM apps.
7. **Version guard on all shared objects.** Every shared object carries a `version: u64` field matched against a `VERSION` package constant. All mutating functions assert `version == VERSION`. An `AdminCap`-gated `migrate` entry fun bumps the version after upgrades, preventing old package versions from operating on shared objects.

---

## 2. On-Chain vs. Off-Chain Decision Matrix

| Data Point | On-Chain | Off-Chain (Postgres) | Rationale |
|---|---|---|---|
| Program merchant wallet | ✅ | mirror | Ownership auth — must be on-chain |
| Program name (short, ≤64 chars) | ✅ | ✅ | On-chain for display/event identification; Postgres for search |
| stamps_required | ✅ | mirror | Core redemption math — must be on-chain |
| is_active / lifecycle state | ✅ | mirror | Gate issuing logic on-chain |
| theme_id | ✅ | mirror | Needed by Display NFT generation |
| total_issued counter | ✅ | derived | On-chain counter; Postgres derives from event stream |
| logo_url | ❌ | ✅ | Mutable, long, not needed for auth |
| reward_description | ❌ | ✅ | Long text, mutable |
| business address / opening hours | ❌ | ✅ | PII-adjacent operational data |
| social links / website | ❌ | ✅ | Operational |
| Category / tags | ❌ | ✅ | Searchable metadata |
| Customer wallet address | ✅ | mirror | Ownership |
| current_stamps | ✅ | mirror | Core stamp math |
| total_earned (redemptions) | ✅ | mirror | Verifiable redemption history |
| last_stamped timestamp | ✅ | mirror | Eligibility / anti-spam |
| Merchant name snapshot on card | ❌ (moved to dynamic field) | ✅ | Was causing stale data — now served from Postgres |
| Merchant logo snapshot on card | ❌ | ✅ | Off-chain only |
| MerchantProfile unlocked_themes | ✅ | mirror | Premium theme entitlement is a paid asset |
| Merchant email / phone | ❌ | ✅ | PII — Postgres only |
| StafferCap (multi-location) | ✅ | mirror | Delegation object is an on-chain capability |
| Analytics / visit counts | ❌ | ✅ | Derived from event stream |
| Redemption history log | ❌ | ✅ | Event-sourced into Postgres |

---

## 3. Move Contract — Rebuilt from Scratch

### 3.1 Package Constants

```move
const VERSION: u64 = 1;                         // bump on every upgrade; shared objects assert this
const FREE_THEME_COUNT: u8 = 6;
const MAX_THEME_ID: u8 = 63;
const MAX_NAME_LEN: u64 = 64;
const PREMIUM_THEME_PRICE_MIST: u64 = 1_000_000_000;
const TREASURY: address = @0x...;               // rotate before mainnet
```

### 3.2 Error Codes

```move
const ENotMerchant: u64 = 0;
const EProgramMismatch: u64 = 1;
const ENotEnoughStamps: u64 = 2;
const ENotCustomer: u64 = 3;
const EInvalidStampsRequired: u64 = 4;
const EInvalidName: u64 = 5;
const EThemeNotFree: u64 = 6;
const EInvalidTheme: u64 = 7;
const EThemeAlreadyOwned: u64 = 8;
const EThemeNotOwned: u64 = 9;
const ENotProfileOwner: u64 = 10;
const EInsufficientPayment: u64 = 11;
const EInvalidDbId: u64 = 12;
const EProgramInactive: u64 = 13;
const ENotStaffer: u64 = 14;
const EWrongVersion: u64 = 15;
```

### 3.3 Object Structs

#### StampProgram (shared)
```move
public struct StampProgram has key {
    id: UID,
    version: u64,            // must equal VERSION; all mutating fns assert this
    merchant: address,
    name: String,            // ≤64 chars; snapshot for event identification
    stamps_required: u64,
    is_active: bool,         // lifecycle gate; replaces delete
    total_issued: u64,       // cards created (via create_card_and_stamp)
    theme_id: u8,
}
```

**Removed from V2:** `logo_url`, `reward_description` (now Postgres only). No `db_id` — the Sui object ID itself (`object::id(program)`) is the FK stored in Postgres.

#### StampCard (shared)
```move
public struct StampCard has key {
    id: UID,
    version: u64,            // must equal VERSION
    program_id: ID,
    customer: address,
    stamps_required: u64,    // snapshot at card creation; sync via sync_card_stamps_required
    current_stamps: u64,
    total_earned: u64,       // completed redemption cycles
    last_stamped: u64,       // ms timestamp
}
```

**Removed from V2:** `merchant_name`, `merchant_logo` — eliminated stale-data sync problem; served from Postgres via JOIN on program_id. No `db_id` — the card's Sui object ID is the FK in Postgres.

#### MerchantProfile (owned)
```move
public struct MerchantProfile has key {
    id: UID,
    merchant: address,
    unlocked_themes: u64,    // bitmask; bit N = theme N unlocked
}
```

No `db_id` — `ProfileCreated` event emits `profile_id: ID`; indexer uses it as `sui_object_id` in Postgres.

#### StafferCap (owned — new in V3)
```move
/// Transferable capability object. Merchant gives this to a staff member or
/// second location. Holder can call issue_stamp on programs the merchant owns.
public struct StafferCap has key, store {
    id: UID,
    program_id: ID,
    staffer: address,
}
```

### 3.4 Events

```move
public struct ProgramCreated has copy, drop { program_id: ID, merchant: address, name: String }
public struct ProgramUpdated has copy, drop { program_id: ID, name: String }
public struct ProgramActivated has copy, drop { program_id: ID }
public struct ProgramDeactivated has copy, drop { program_id: ID }
public struct CardCreated has copy, drop { card_id: ID, program_id: ID, customer: address }
public struct StampIssued has copy, drop { card_id: ID, program_id: ID, customer: address, new_count: u64, staffer: address }
public struct StampRedeemed has copy, drop { card_id: ID, program_id: ID, customer: address, redemption_count: u64 }
public struct ThemeChanged has copy, drop { program_id: ID, merchant: address, old_theme_id: u8, new_theme_id: u8 }
public struct ProfileCreated has copy, drop { profile_id: ID, merchant: address }
public struct ThemePurchased has copy, drop { profile_id: ID, merchant: address, theme_id: u8 }
public struct StafferCapIssued has copy, drop { cap_id: ID, program_id: ID, staffer: address }
public struct StafferCapRevoked has copy, drop { cap_id: ID, program_id: ID }
public struct MerchantTransferred has copy, drop { program_id: ID, old_merchant: address, new_merchant: address }
```

### 3.5 Public Functions

#### Program Lifecycle
```
create_program(name, stamps_required, theme_id, ctx)  → shares StampProgram (version = VERSION)
update_program(program, name, ctx)                    → updates name; asserts version
set_theme(program, theme_id, ctx)                     → free themes only
set_premium_theme(program, profile, theme_id, ctx)    → premium themes
deactivate_program(program, ctx)                      → is_active = false
reactivate_program(program, ctx)                      → is_active = true
transfer_merchant(program, new_merchant, ctx)
```

#### Stamp Flow
```
create_card_and_stamp(program, customer, clock, ctx)        → creates+shares StampCard; version = VERSION
issue_stamp(program, card, clock, ctx)                      → merchant stamps; asserts version on both
issue_stamp_as_staffer(program, card, cap, clock, ctx)      → staffer stamps
redeem(program, card, ctx)                                  → customer redeems; carry-forward excess
```

#### StafferCap Management
```
issue_staffer_cap(program, staffer, ctx) → transfers StafferCap to staffer
revoke_staffer_cap(cap, program, ctx)    → merchant burns cap; emits StafferCapRevoked
```

#### Upgrade Migration
```
// AdminCap held by deployer — used only for migration entry funs
public struct AdminCap has key { id: UID }

// Called after package upgrade to bump shared object versions
entry fun migrate_program(program: &mut StampProgram, _: &AdminCap) {
    assert!(program.version < VERSION, EWrongVersion);
    // apply any dynamic field migrations here
    program.version = VERSION;
}
entry fun migrate_card(card: &mut StampCard, _: &AdminCap) { ... }
```

All mutating functions guard with `assert!(program.version == VERSION, EWrongVersion)` so clients using old package versions fail cleanly rather than operating on stale objects.

Note: `revoke_staffer_cap` requires the merchant to hold the cap. For emergency revocation without cap possession (staffer gone rogue), the merchant calls `deactivate_program` to halt all stamping, then reactivates after issuing a fresh cap to correct staffers. This is the simplest safe path without an admin registry.

#### MerchantProfile
```
create_and_transfer_merchant_profile(db_id, ctx)  → owned profile
purchase_theme(profile, theme_id, payment, ctx)
```

#### Metadata Sync
```
sync_card_stamps_required(program, card, ctx)  → pushes updated stamps_required to card snapshot
```

(No `sync_card_metadata` for name/logo — those are now purely off-chain.)

### 3.6 Dynamic Fields (Extensibility Hooks)

Every major object gets a `dynamic_field` namespace so we can bolt on new attributes post-deploy without a struct change:

```move
// Example: attach a "tier" label to a StampCard post-launch
dynamic_field::add(&mut card.id, b"tier", b"gold");

// Example: attach a "max_cards_per_customer" cap to a program
dynamic_field::add(&mut program.id, b"max_cards", 1u64);
```

Keys are `vector<u8>` byte strings. We maintain a naming registry in this doc (see Section 6).

### 3.7 Error Constants — Clever Errors

Use Move 2024's `#[error]` attribute for human-readable abort messages instead of raw `u64` codes:

```move
#[error]
const ENotMerchant: vector<u8> = b"Caller is not the program merchant";
#[error]
const EWrongVersion: vector<u8> = b"Package upgrade required — call migrate first";
// ... etc.
```

This significantly improves debuggability in explorers and client-side error handling at zero semantic cost.

### 3.8 Display V2 Migration Deadline

**Display V1 aborts after July 2026.** Sui v1.68 introduces Display V2. Before that deadline:

1. Add a `migrate_v1_to_v2` entry fun (provided by Mysten Labs in the upgrade framework).
2. V2 adds: collection access (vectors/maps), dynamic field access in templates, cross-object field references via `{object_field.nested_field}` syntax.
3. The `image_url` Display template should use `ipfs://` protocol prefix in the URL (not gateway URLs) for content-addressing permanence.

### 3.9 Upgrade Policy

`Move.lock` must be committed to git — do not add it to `.gitignore`.

Published with `{ upgrade_policy: "compatible" }` in `Move.toml`. This allows:
- Adding new functions ✅
- Adding new public structs ✅
- Changing function bodies ✅

This forbids:
- Removing or renaming existing public functions ❌
- Removing or reordering struct fields ❌
- Changing function signatures ❌

All breaking changes must be expressed via new functions or dynamic fields.

---

## 4. Neon Postgres Schema

Connection strategy:
- **Pooled URL** (`DATABASE_URL`) — `pg` + Vercel Fluid `attachDatabasePool` for API routes and Server Components
- **Direct URL** (`DATABASE_URL_UNPOOLED`) — Drizzle migrations only (`drizzle-kit push`)

ORM: **Drizzle ORM** (TypeScript-first, Vercel-recommended)

### 4.1 Core Tables

```sql
-- Merchant profile (one per wallet)
CREATE TABLE merchant_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id   TEXT NOT NULL UNIQUE,   -- MerchantProfile object ID on Sui
    wallet_address  TEXT NOT NULL UNIQUE,   -- indexed
    business_name   TEXT NOT NULL,
    display_name    TEXT,
    email           TEXT,                   -- PDPA: encrypted at rest
    phone           TEXT,                   -- PDPA: encrypted at rest
    website         TEXT,
    instagram       TEXT,
    logo_url        TEXT,
    category        TEXT,
    address_text    TEXT,                   -- PDPA: encrypted at rest
    opening_hours   JSONB,
    is_verified     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Stamp programs
CREATE TABLE stamp_programs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id       TEXT NOT NULL UNIQUE,   -- StampProgram object ID
    merchant_profile_id UUID NOT NULL REFERENCES merchant_profiles(id),
    name                TEXT NOT NULL,           -- synced from chain event
    stamps_required     INTEGER NOT NULL,        -- synced from chain
    is_active           BOOLEAN DEFAULT true,    -- synced from chain
    logo_url            TEXT NOT NULL DEFAULT '',
    reward_description  TEXT NOT NULL DEFAULT '',
    theme_id            SMALLINT DEFAULT 0,
    total_issued        INTEGER DEFAULT 0,       -- derived from events
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Customer stamp cards
CREATE TABLE stamp_cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id       TEXT NOT NULL UNIQUE,   -- StampCard object ID
    program_id          UUID NOT NULL REFERENCES stamp_programs(id),
    customer_wallet     TEXT NOT NULL,
    current_stamps      INTEGER DEFAULT 0,      -- synced from chain
    total_earned        INTEGER DEFAULT 0,      -- synced from chain
    last_stamped        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Event log (idempotent replay-safe indexer sink)
CREATE TABLE sui_events (
    id              BIGSERIAL PRIMARY KEY,
    tx_digest       TEXT NOT NULL UNIQUE,       -- idempotency key
    event_type      TEXT NOT NULL,
    object_id       TEXT,
    payload         JSONB NOT NULL,
    processed_at    TIMESTAMPTZ DEFAULT now()
);

-- Redemption history (derived from StampRedeemed events)
CREATE TABLE redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES stamp_cards(id),
    program_id      UUID NOT NULL REFERENCES stamp_programs(id),
    tx_digest       TEXT NOT NULL UNIQUE,       -- idempotency key
    redeemed_at     TIMESTAMPTZ NOT NULL,
    redemption_count INTEGER NOT NULL           -- total_earned snapshot at time of redemption
);

-- Staffer caps (mirrors on-chain for fast lookups)
CREATE TABLE staffer_caps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id   TEXT NOT NULL UNIQUE,       -- StafferCap object ID
    program_id      UUID NOT NULL REFERENCES stamp_programs(id),
    staffer_wallet  TEXT NOT NULL,
    is_revoked      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Indexes

```sql
CREATE INDEX idx_stamp_programs_merchant ON stamp_programs(merchant_profile_id);
CREATE INDEX idx_stamp_cards_program ON stamp_cards(program_id);
CREATE INDEX idx_stamp_cards_customer ON stamp_cards(customer_wallet);
CREATE INDEX idx_stamp_cards_program_customer ON stamp_cards(program_id, customer_wallet);
CREATE INDEX idx_redemptions_card ON redemptions(card_id);
CREATE INDEX idx_sui_events_type ON sui_events(event_type);
CREATE INDEX idx_sui_events_object ON sui_events(object_id);
CREATE INDEX idx_staffer_caps_program ON staffer_caps(program_id);
```

### 4.3 PDPA Compliance Notes

Fields marked "PDPA: encrypted at rest" use `pgcrypto` AES-256 symmetric encryption. The encryption key lives in `POSTGRES_ENCRYPTION_KEY` env var (never in the schema). A soft-delete + data wipe path must be provided:

```sql
-- PDPA erasure: wipe PII but retain pseudonymous record
UPDATE merchant_profiles
SET email = NULL, phone = NULL, address_text = NULL, business_name = '[deleted]'
WHERE id = $1;
```

The wallet address itself is considered pseudonymous (not PII) and is retained for audit trail purposes.

---

## 5. Event Indexer Architecture

### 5.1 Technology Choice

Use **buidly `sui-events-indexer`** (TypeScript) or a custom minimal indexer in `src/indexer/`. The indexer:
1. Subscribes to Sui events filtered by `package_id` + event type
2. For each event, checks `sui_events.tx_digest` (idempotency — skip if exists)
3. Applies state mutations to the appropriate Postgres tables
4. Records the raw event in `sui_events`

### 5.2 Event Handlers

| Sui Event | Postgres Effect |
|---|---|
| `ProgramCreated` | INSERT into `stamp_programs` |
| `ProgramUpdated` | UPDATE `stamp_programs` name |
| `ProgramActivated` | UPDATE `stamp_programs` is_active = true |
| `ProgramDeactivated` | UPDATE `stamp_programs` is_active = false |
| `CardCreated` | INSERT into `stamp_cards` with 1 stamp |
| `StampIssued` | UPDATE `stamp_cards` current_stamps, last_stamped; UPDATE `stamp_programs` total_issued |
| `StampRedeemed` | UPDATE `stamp_cards` current_stamps, total_earned; INSERT into `redemptions` |
| `ThemeChanged` | UPDATE `stamp_programs` theme_id |
| `ProfileCreated` | INSERT into `merchant_profiles` (wallet only; merchant fills rest via UI) |
| `ThemePurchased` | No direct table write (profile's `unlocked_themes` is read live from chain) |
| `StafferCapIssued` | INSERT into `staffer_caps` |
| `StafferCapRevoked` | UPDATE `staffer_caps` is_revoked = true |
| `MerchantTransferred` | UPDATE `stamp_programs` (requires re-linking merchant_profile_id) |

### 5.3 Replay Safety

Every handler is idempotent:
```typescript
const existing = await db.query.suiEvents.findFirst({
  where: eq(suiEvents.txDigest, event.id.txDigest),
});
if (existing) return; // already processed
```

### 5.4 Cursor Persistence

The indexer persists its Sui event cursor in a `indexer_checkpoints` table:
```sql
CREATE TABLE indexer_checkpoints (
    key     TEXT PRIMARY KEY,
    cursor  TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

On restart, the indexer resumes from the last saved cursor, preventing gaps.

---

## 6. Dynamic Field Registry

Pre-registered key names for dynamic fields attached to on-chain objects (added via future upgrades or PTBs):

| Object | Key (bytes) | Type | Purpose |
|---|---|---|---|
| StampProgram | `b"max_cards_per_wallet"` | `u64` | Rate-limit card creation per customer |
| StampProgram | `b"expiry_days"` | `u64` | Stamp expiry period (0 = no expiry) |
| StampProgram | `b"campaign_end_ms"` | `u64` | Campaign end timestamp |
| StampCard | `b"tier"` | `vector<u8>` | Customer tier label (e.g. "gold") |
| StampCard | `b"bonus_stamps"` | `u64` | One-time bonus stamp grants |
| MerchantProfile | `b"verified_at_ms"` | `u64` | Verification timestamp |

Keys are globally namespaced by convention `b"suiki_<name>"` for safety in multi-package PTBs.

---

## 7. API Layer Design

### 7.1 Data Fetching Strategy

- **Server Components** read from Neon Postgres directly (fast, no RPC latency).
- **Client Components** use TanStack Query hooks that call Next.js API routes.
- **On-chain reads** (e.g. live stamp count) use `SuiGrpcClient` via `src/lib/sui-client.ts` for freshness when needed.

### 7.2 Key API Routes

```
GET  /api/programs/[programId]          → program + merchant profile JOIN
GET  /api/programs/[programId]/cards    → paginated stamp cards for a program
GET  /api/customer/[wallet]/cards       → all cards for a customer wallet
GET  /api/customer/[wallet]/cards/[id]  → single card detail
POST /api/merchant/programs             → create program (writes DB + initiates PTB)
PUT  /api/merchant/programs/[id]        → update program metadata (DB only; no chain call)
POST /api/merchant/programs/[id]/stamp  → trigger issue_stamp PTB
```

### 7.3 Merge Strategy (Chain + DB)

For pages that show a stamp card, the canonical data flow is:

```
Postgres stamp_cards (current_stamps, total_earned, last_stamped)
  +
Postgres stamp_programs JOIN merchant_profiles (name, logo_url, reward_description, theme_id)
  =
Full card view ← served by GET /api/customer/[wallet]/cards/[id]
```

The chain is not queried for routine card display — only when the user explicitly wants to verify on-chain state (e.g. "verify on blockchain" link).

---

## 8. Multi-Location Stamping (StafferCap)

### Flow

1. Merchant calls `issue_staffer_cap(program, staffer_wallet, ctx)` — creates `StafferCap` owned by `staffer_wallet`.
2. Staff member opens Suiki POS on their device. Their connected wallet holds the `StafferCap`.
3. When stamping, the app calls `issue_stamp_as_staffer(program, card, cap, clock, ctx)`.
4. `StampIssued` event includes `staffer: address` field — the indexer records which staffer issued the stamp.
5. To revoke: merchant calls `revoke_staffer_cap(cap, program, ctx)`. If the cap is in the staffer's custody, the merchant must get it back first OR deactivate the program temporarily.

### Permissions Model

| Actor | Can do |
|---|---|
| Merchant wallet | create_program, update_program, set_theme, issue_stamp, create_card_and_stamp, issue_staffer_cap, revoke_staffer_cap, deactivate_program, transfer_merchant |
| StafferCap holder | issue_stamp_as_staffer only |
| Customer wallet | redeem |

---

## 9. Program Lifecycle

```
CREATED → ACTIVE → DRAINING → INACTIVE
                ↑____________↓  (reactivate)
```

- **ACTIVE** (`is_active = true`): Normal operation. New cards can be created, stamps issued.
- **INACTIVE** (`is_active = false`): No new cards, no new stamps. Customers can still redeem existing stamps.
- **DRAINING**: Not a distinct on-chain state. Merchant deactivates; existing cards with stamps remain redeemable indefinitely.

There is no on-chain `delete` for programs or cards. Shared objects cannot be deleted in current Sui. The `is_active` flag is the lifecycle gate.

---

## 10. Migration Path (V2 → V3)

Since this is a full rebuild (not deployed to mainnet yet), migration means:

1. **Delete old contracts** — clear `move/suiki/sources/suiki.move` and rewrite from spec.
2. **New Neon Postgres database** — run Drizzle migrations on a fresh Neon project.
3. **New `.env.local`** — update `NEXT_PUBLIC_PACKAGE_ID`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
4. **No data migration needed** — testnet is ephemeral. Fresh deploy with new package ID.
5. **UI layer** — remove all `merchant_name`/`merchant_logo` on-card reads. Serve from Postgres JOIN instead.

---

## 11. Open Questions (Deferred to Implementation)

| # | Question | Decision |
|---|---|---|
| 1 | Indexer deployment: Vercel Cron vs. dedicated process? | Use Vercel Cron + `api/indexer/tick` for simplicity in V3; migrate to dedicated process at scale |
| 2 | `db_id` format: UUID string or raw 16-byte vector? | 32-byte vector (UUID v4 bytes, no hyphens) — more gas-efficient than string |
| 3 | Should `redeem` require merchant witness? | No — customer self-redeems; merchant fulfills reward out-of-band. Simplicity wins. |
| 4 | `sync_card_stamps_required` — who calls it? | Merchant calls it after updating program. We surface a "Sync cards" button in merchant dashboard. |
| 5 | Staffer revocation without cap custody | Merchant deactivates program → issues new cap to correct staffers → reactivates. Acceptable V3 UX. |
