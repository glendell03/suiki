---
title: "Suiki — Architecture Map"
date: 2026-03-25
status: active
tags:
  - project/suiki
  - blockchain/sui
  - type/architecture
  - reference/technical-map
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — Architecture Map

Comprehensive technical reference for the Suiki PWA: a SUI blockchain loyalty stamp card system for Filipino MSMEs.

---

## Object Model

### StampProgram (Shared Object)

**Location:** `move/suiki/sources/suiki.move` — lines 42-53

**Type:** Shared object owned by merchant (but readable by all)

**Fields:**
```move
public struct StampProgram has key {
    id: UID,                    // Unique identifier on SUI
    merchant: address,          // Merchant's wallet address
    name: String,               // e.g., "Kape ni Juan"
    logo_url: String,           // Merchant-hosted image URL (Facebook, Google Drive)
    stamps_required: u64,       // e.g., 10 stamps = 1 reward
    reward_description: String, // e.g., "Free brewed coffee"
    total_issued: u64,          // Lifetime count of stamps issued
}
```

**Abilities:**
- `key`: Storable on-chain as a Move object
- No `copy`: Cannot be copied in Place (immutable identity)

**Who owns/manages:**
- **Owner:** Merchant (creator)
- **Readers:** Customers, app UI, event listeners
- **Mutators:** Merchant only (via `issue_stamp`, `create_card_and_stamp`, `update_program`)

**Display Standard Integration:**
- Metadata fields (`name`, `logo_url`) are linkage points for StampCard NFT rendering
- When merchant updates `logo_url` or `name`, all linked StampCard NFTs automatically update Display visuals
- No re-minting needed — Display is mutable and upgradeable

**Key Functions That Affect:**
- `create_program()` — creates new shared object
- `issue_stamp()` — increments `total_issued` counter
- `create_card_and_stamp()` — increments `total_issued` counter
- `update_program()` — modifies `name`, `logo_url`, `reward_description`

---

### StampCard (Shared Object, NFT)

**Location:** `move/suiki/sources/suiki.move` — lines 56-68

**Type:** Shared object owned by customer (but merchant can mutate during issuance/redemption)

**Fields:**
```move
public struct StampCard has key {
    id: UID,                    // Unique NFT identifier
    program_id: ID,             // Reference to merchant's StampProgram
    customer: address,          // Customer's wallet address
    merchant_name: String,      // Snapshot of merchant name at card creation
    merchant_logo: String,      // Snapshot of merchant logo URL
    stamps_required: u64,       // Snapshot: how many to redeem
    current_stamps: u64,        // Working counter: resets on redemption
    total_earned: u64,          // Lifetime: never resets, for credit history
    last_stamped: u64,          // Timestamp in milliseconds
}
```

**Abilities:**
- `key`: Storable on-chain as a Move object

**Who owns/manages:**
- **Owner:** Customer (who earned stamps)
- **Mutators:**
  - Merchant (via `issue_stamp` to increment `current_stamps`)
  - Customer (via `redeem` to reset `current_stamps` and increment `total_earned`)
- **Display Renderer:** Slush wallet NFT view, Suiki PWA

**Shared vs Owned Design Rationale:**
- StampCard is a **shared object** (not owned-only) because the **merchant must be able to mutate it** when issuing stamps
- Owned objects in SUI can only be mutated by their owner, which would prevent merchants from stamping
- Tradeoff: Shared objects go through consensus (~600ms) vs owned (~400ms) — imperceptible for stamp cards

**NFT Display Standard Setup:**
- `init()` function creates a `Display<StampCard>` template with fields:
  - `name`: `"{merchant_name} Loyalty Card"`
  - `description`: `"{current_stamps}/{stamps_required} stamps collected"`
  - `image_url`: `"{merchant_logo}"`
  - `project_url`: `"https://suiki.app"`
- Template is **mutable** — when merchant updates program data, Display updates automatically
- No re-minting required

**Key Functions That Affect:**
- `create_card_and_stamp()` — creates card with first stamp
- `issue_stamp()` — increments `current_stamps`, updates `last_stamped`
- `redeem()` — resets `current_stamps` to 0, increments `total_earned`

---

### Object Relationships

```
StampProgram (merchant-owned shared object)
    ↓ references
    └─── StampCard (customer-owned shared objects)
             ↓ contains
             └─── program_id (ID pointer back to StampProgram)

Display<StampCard> template
    ↓ renders using
    └─── merchant_name, merchant_logo from card
         (derived from program at card creation time)
```

**Key relationship invariant:**
- A StampCard is always associated with exactly one StampProgram via `program_id`
- A StampProgram can have multiple StampCards (one per customer)
- When merchant updates program details, linked cards don't change their snapshot fields, but their Display template updates via the program reference

---

## Transaction Flow Map

### Flow 1: `create_program` — Merchant Launches Loyalty Program

**Function signature (Move):**
```move
public fun create_program(
    name: String,
    logo_url: String,
    stamps_required: u64,
    reward_description: String,
    ctx: &mut TxContext,
)
```

**Location:** `move/suiki/sources/suiki.move` — lines 149-166

**Who calls:** Merchant (authenticated by Slush wallet)

**On-chain actions:**
1. Create new `StampProgram` struct with `UID`
2. Set `merchant = ctx.sender()` (caller's address)
3. Initialize `total_issued = 0`
4. Make object `share_object()` (becomes shared, readable by all)

**Emits event:**
```move
public struct ProgramCreated has copy, drop {
    program_id: ID,
    merchant: address,
    name: String,
}
```

**Client flow (TypeScript):**
1. Merchant fills form: name, logo URL, stamps required, reward description
2. Frontend calls `buildCreateProgram()` from `src/lib/transactions.ts`
3. Transaction is built (not signed yet)
4. Sent to `/api/sponsor` endpoint to get sponsor signature
5. User signs with Slush wallet
6. Transaction submitted to SUI RPC
7. On success: `ProgramCreated` event emitted, program appears on-chain
8. Frontend polls to fetch new program object ID, stores in local state

**Gas sponsorship:**
- Free tier merchant: Sponsor wallet covers 100% of gas
- Transaction type: `moveCall`
- Approximate gas: ~5-7 million units (~$0.01-0.02 USD at SUI prices)

**Result:** Merchant now has a public stamp program with a shareable program ID.

---

### Flow 2: `create_card_and_stamp` — Merchant Creates Customer's First Card + First Stamp

**Function signature (Move):**
```move
public fun create_card_and_stamp(
    program: &mut StampProgram,
    customer: address,
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**Location:** `move/suiki/sources/suiki.move` — lines 169-199

**Who calls:** Merchant (must be the program creator)

**Access control:**
```move
assert!(program.merchant == ctx.sender(), ENotMerchant);
```

**On-chain actions:**
1. Create new `StampCard` with `UID`
2. Set `customer = customer` (passed address)
3. Initialize `current_stamps = 1` (first stamp)
4. Initialize `total_earned = 0`
5. Snapshot merchant name, logo, stamps_required from program
6. Increment `program.total_issued`
7. Make card `share_object()` (becomes shared)

**Emits events:**
```move
public struct CardCreated has copy, drop {
    card_id: ID,
    program_id: ID,
    customer: address,
}

public struct StampIssued has copy, drop {
    card_id: ID,
    program_id: ID,
    customer: address,
    new_count: u64,  // = 1
}
```

**Client flow:**
1. Merchant scans customer's QR (which contains customer address)
2. Or enters customer address manually
3. Frontend calls `buildCreateCardAndStamp()` with program ID + customer address
4. Transaction submitted with gas sponsorship
5. User (merchant) signs with Slush wallet
6. On success: events emitted, card appears on-chain
7. Customer's wallet now contains the StampCard NFT (via Display standard)

**Gas sponsorship:**
- Free tier: Sponsor wallet covers 100%
- Approximate gas: ~7-9 million units

**Result:** Customer has their first StampCard NFT with 1 stamp collected.

---

### Flow 3: `issue_stamp` — Merchant Stamps Existing Customer Card

**Function signature (Move):**
```move
public fun issue_stamp(
    program: &mut StampProgram,
    card: &mut StampCard,
    clock: &Clock,
    ctx: &TxContext,
)
```

**Location:** `move/suiki/sources/suiki.move` — lines 202-221

**Who calls:** Merchant (authenticates via Slush wallet signing)

**Access control:**
```move
assert!(program.merchant == ctx.sender(), ENotMerchant);
assert!(card.program_id == object::id(program), EProgramMismatch);
```

**Shared object mutation model:**
- Since `StampCard` is shared, both merchant and customer can interact with it
- Merchant stamps → transaction goes through SUI consensus
- Merchant can only mutate if `program.merchant == ctx.sender()`

**On-chain actions:**
1. Increment `card.current_stamps += 1`
2. Update `card.last_stamped = clock.timestamp_ms()`
3. Increment `program.total_issued += 1`

**Emits event:**
```move
public struct StampIssued has copy, drop {
    card_id: ID,
    program_id: ID,
    customer: address,
    new_count: u64,  // = current_stamps after increment
}
```

**Client flow (QR-based):**
1. Merchant scans customer's QR → extracts customer address
2. Frontend already has merchant's program ID (from auth context)
3. Queries to find customer's existing StampCard for that program
4. Frontend calls `buildIssueStamp()` with program ID + card ID
5. Transaction built, sent to `/api/sponsor` for sponsorship
6. Merchant signs with Slush wallet
7. Transaction submitted
8. On success: `StampIssued` event emitted, card's counter increments in Slush wallet

**Client flow (Manual):**
1. Merchant enters customer address in UI
2. Frontend fetches all customer's cards
3. Filters to show cards for this program
4. Merchant selects card from dropdown
5. Clicks "Issue Stamp" button
6. Same transaction flow as above

**Gas sponsorship rate limiting (Free tier):**
- 50 sponsored transactions per merchant per day
- After 50: user must pay own gas or upgrade to Premium
- Alert when gas wallet balance drops to 20% remaining

**Result:** Customer's card counter increments from N to N+1.

---

### Flow 4: `redeem` — Customer Redeems Stamps for Reward

**Function signature (Move):**
```move
public fun redeem(
    program: &StampProgram,
    card: &mut StampCard,
    ctx: &TxContext,
)
```

**Location:** `move/suiki/sources/suiki.move` — lines 224-235

**Who calls:** Customer (authenticates via Slush wallet signing)

**Access control:**
```move
assert!(card.customer == ctx.sender(), ENotCustomer);
assert!(card.program_id == object::id(program), EProgramMismatch);
assert!(card.current_stamps >= program.stamps_required, ENotEnoughStamps);
```

**On-chain actions:**
1. Check that `current_stamps >= stamps_required` (e.g., has 10 stamps when 10 required)
2. Add current_stamps to lifetime total: `total_earned += current_stamps`
3. Reset current_stamps to 0
4. Emit `StampRedeemed` event

**Emits event:**
```move
public struct StampRedeemed has copy, drop {
    card_id: ID,
    program_id: ID,
    customer: address,
    total_earned: u64,  // = lifetime total after increment
}
```

**Client flow (customer-initiated):**
1. Customer opens their StampCard in Suiki PWA
2. Sees "You have 10/10 stamps — Ready to redeem!"
3. Clicks "Redeem Reward" button
4. UI shows reward description from program
5. Asks "Confirm redemption?" (with optional merchant approval UI)
6. Customer clicks confirm
7. Frontend calls `buildRedeem()` with program ID + card ID
8. Transaction built and signed by customer
9. Transaction submitted (no sponsorship needed — customer pays gas)
10. On success: `StampRedeemed` event emitted, card's counter resets to 0
11. UI updates to show "0/10 stamps collected — Start collecting again!"

**Gas sponsorship:**
- Redemption is NOT sponsored (customer pays their own gas)
- This is intentional: redemption is infrequent and signals customer's commitment
- Gas cost: ~5-7 million units

**Result:** Customer's card resets to 0 stamps, lifetime total increments by N.

---

### Flow 5: `update_program` — Merchant Updates Program Details

**Function signature (Move):**
```move
public fun update_program(
    program: &mut StampProgram,
    name: String,
    logo_url: String,
    reward_description: String,
    ctx: &TxContext,
)
```

**Location:** `move/suiki/sources/suiki.move` — lines 238-248

**Who calls:** Merchant (must be program creator)

**Access control:**
```move
assert!(program.merchant == ctx.sender(), ENotMerchant);
```

**On-chain actions:**
1. Update `program.name`
2. Update `program.logo_url`
3. Update `program.reward_description`
4. Emit `ProgramUpdated` event

**Emits event:**
```move
public struct ProgramUpdated has copy, drop {
    program_id: ID,
    name: String,
    logo_url: String,
}
```

**NFT Display Update (automatic):**
- All linked `StampCard` NFTs reference this program via `program_id`
- Slush wallet queries the program, fetches updated metadata
- StampCard Display automatically re-renders with new logo, name
- No customer action needed
- **Use case:** Carinderia updates logo to Christmas-themed image in December — all customer cards instantly show new design

**Client flow:**
1. Merchant navigates to their program details page
2. Clicks "Edit Program" button
3. Form pre-fills with current name, logo URL, reward description
4. Merchant updates fields
5. Clicks "Save Changes"
6. Frontend calls `buildUpdateProgram()` with new values
7. Transaction submitted with gas sponsorship
8. Merchant signs with Slush wallet
9. On success: Display metadata updates across all linked cards

**Gas sponsorship:**
- Free tier: Sponsor wallet covers 100%
- Approximate gas: ~4-5 million units

**Result:** Program metadata updates on-chain; all linked StampCard NFTs visually update in wallets.

---

## QR Code Data Format

### Merchant QR Code (Issued by Merchant)

**Encodes:**
```json
{
  "type": "merchant",
  "program_id": "0x1234...abcd",
  "wallet_address": "0xCAFE...BEEF"
}
```

**Size:** ~200-300 bytes (standard QR code, easily scannable on mobile)

**Used in flow:**
- Merchant prints or displays QR code in physical store
- Customer scans with Suiki app
- App recognizes `type: "merchant"` → navigates to program detail page
- Shows: program name, logo, stamp count goal, reward description
- Customer can see progress but does NOT issue stamp yet
- If customer wants to earn stamp, must switch roles (customer → merchant) or have merchant scan customer QR

---

### Customer QR Code (Issued by Customer)

**Encodes:**
```json
{
  "type": "customer",
  "wallet_address": "0xBEEF...CAFE"
}
```

**Size:** ~100-150 bytes (very compact)

**Used in flow:**
- Merchant scans customer's QR code (customer displays on screen)
- App recognizes `type: "customer"` → enters issue-stamp mode
- Merchant's app automatically calls `issue_stamp` on customer's card for merchant's program
- Transaction submitted with gas sponsorship
- On success: customer's card counter increments

---

### App Resolution Logic

```
QR Data Scanned
    ↓
Parse JSON
    ↓
Check "type" field
    ├─ "merchant" → Program Detail Page
    │    ├─ Display program name, logo, reward
    │    └─ Query on-chain to find customer's card for this program
    │
    └─ "customer" → Issue Stamp Flow
         ├─ Get customer address from payload
         ├─ Get merchant's program ID from app state (current user)
         ├─ Call buildIssueStamp()
         ├─ Send to /api/sponsor
         └─ Submit with merchant's signature
```

---

## File Structure Map

**Total files to create:** 23 files across 13 tasks

### By Task

#### Task 1: Project Scaffolding (Files: 5)
```
suiki/
├── package.json              # npm dependencies + scripts
├── next.config.ts            # Next.js + PWA configuration
├── tailwind.config.ts        # Tailwind CSS theming
├── tsconfig.json             # TypeScript configuration
└── .env.local                # Environment: PACKAGE_ID, SPONSOR_KEY
```

#### Task 2: Move Smart Contract Core (Files: 2)
```
move/suiki/
├── Move.toml                 # Move.toml manifest
└── sources/
    └── suiki.move            # All functions + Display init + events (830 lines)
```

#### Task 3: Move Contract Tests (Files: 1)
```
move/suiki/
└── tests/
    └── suiki_tests.move      # 7 test scenarios (test_scenario API)
```

#### Task 4: Deploy to Testnet (Modifies: 1)
```
.env.local                     # Updated with NEXT_PUBLIC_PACKAGE_ID
```

#### Task 5: SUI Client + Wallet Provider (Files: 4)
```
src/
├── lib/
│   └── constants.ts          # PACKAGE_ID, CLOCK_ID, TARGETS
├── app/
│   └── providers.tsx         # SuiClientProvider + WalletProvider + QueryClient
├── components/
│   └── connect-wallet.tsx    # ConnectButton wrapper
└── app/
    └── layout.tsx            # Providers wrapper + root metadata
```

#### Task 6: Gas Station Sponsor API (Files: 1)
```
src/app/api/sponsor/
└── route.ts                  # POST /api/sponsor — builds + sponsors tx
```

#### Task 7: Transaction Builders + Queries + Hooks (Files: 5)
```
src/
├── lib/
│   ├── transactions.ts       # buildCreateProgram, buildIssueStamp, etc.
│   └── queries.ts            # fetchPrograms, fetchCards, parseObjects
└── hooks/
    ├── use-my-programs.ts    # useQuery hook for merchant's programs
    ├── use-my-cards.ts       # useQuery hook for customer's cards
    └── use-sponsored-tx.ts   # Sponsor + sign + execute flow
```

#### Task 8: Merchant Create Program Page (Files: 2)
```
src/app/merchant/
├── page.tsx                  # Dashboard listing user's programs
└── create/page.tsx           # Form: name, logo URL, stamps required, reward
```

#### Task 9: QR Code Components (Files: 3)
```
src/components/
├── qr-code.tsx               # Display QR (qrcode.react)
├── qr-scanner.tsx            # Scan QR (html5-qrcode)
└── stamp-card-display.tsx    # Render a single StampCard object
```

#### Task 10: Merchant Issue Stamp Flow (Files: 2)
```
src/app/merchant/
├── [programId]/page.tsx      # Program detail + QR scanner + scan result
└── (implied) issue UI components
```

#### Task 11: Customer Stamp Collection View (Files: 2)
```
src/app/customer/
├── page.tsx                  # Main customer dashboard (all cards)
└── scan/page.tsx             # Scan merchant QR to view program
```

#### Task 12: Landing Page + Navigation (Files: 1)
```
src/app/page.tsx              # Landing: choose merchant or customer role
```

#### Task 13: PWA Finalization + E2E (Files: 2)
```
public/manifest.json          # PWA manifest
public/icons/                 # icon-192.png, icon-512.png
```

---

### Complete Directory Tree (After All Tasks)

```
suiki/
├── move/suiki/
│   ├── Move.toml
│   ├── sources/
│   │   └── suiki.move
│   └── tests/
│       └── suiki_tests.move
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── providers.tsx
│   │   ├── api/sponsor/
│   │   │   └── route.ts
│   │   ├── merchant/
│   │   │   ├── page.tsx
│   │   │   ├── create/page.tsx
│   │   │   └── [programId]/page.tsx
│   │   └── customer/
│   │       ├── page.tsx
│   │       └── scan/page.tsx
│   ├── lib/
│   │   ├── constants.ts
│   │   ├── sui-client.ts
│   │   ├── transactions.ts
│   │   └── queries.ts
│   ├── components/
│   │   ├── connect-wallet.tsx
│   │   ├── qr-code.tsx
│   │   ├── qr-scanner.tsx
│   │   ├── stamp-card-display.tsx
│   │   └── stamp-progress.tsx
│   └── hooks/
│       ├── use-my-programs.ts
│       ├── use-my-cards.ts
│       └── use-sponsored-tx.ts
├── public/
│   ├── manifest.json
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── globals.css
├── .env.local
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Dependencies Map

### Task Dependency Graph

```
Task 1 (Scaffolding)
    ↓ required by
    ├─ Task 5 (Wallet Provider)
    ├─ Task 6 (Sponsor API)
    ├─ Task 7 (Transactions)
    ├─ Task 8-13 (All UI tasks)

Task 2 (Move Core)
    ↓ required by
    ├─ Task 3 (Tests)
    ├─ Task 4 (Deploy)
    ├─ Task 7 (Transactions reference contract)

Task 3 (Tests)
    ↓ optional after
    └─ Task 2

Task 4 (Deploy)
    ↓ produces PACKAGE_ID
    ├─ required by Task 5
    ├─ required by Task 6
    ├─ required by Task 7

Task 5 (Wallet Provider)
    ↓ required by
    ├─ Task 6 (API context)
    ├─ Task 7 (Transactions)
    ├─ Task 8-13 (All UI)

Task 6 (Sponsor API)
    ↓ required by
    ├─ Task 10 (Merchant issue flow)
    └─ Task 11 (Customer redeem)

Task 7 (Transactions + Hooks)
    ↓ required by
    ├─ Task 8 (Create program)
    ├─ Task 10 (Issue stamp)
    ├─ Task 11 (Redeem + view cards)

Task 8 (Merchant Create)
    ├─ can start after Task 7
    └─ used by Task 10

Task 9 (QR Components)
    ├─ can start after Task 5
    └─ used by Task 10 + Task 11

Task 10 (Merchant Issue Flow)
    ├─ requires Task 7, Task 8, Task 9
    └─ independent of Task 11

Task 11 (Customer View)
    ├─ requires Task 7, Task 9
    └─ independent of Task 10

Task 12 (Landing Page)
    ├─ requires Task 1
    └─ routes to Task 8 + Task 11

Task 13 (PWA Finalization)
    ├─ requires Task 1, Task 12
    └─ last task
```

### Parallel Work Opportunities

**Phase 1 (Sequential blocker):**
- Task 1: Scaffolding
- Task 2: Move contract (can run in parallel with Task 1)

**Phase 2 (Wait for PACKAGE_ID):**
- Task 3: Tests (parallel with Task 4)
- Task 4: Deploy (blocks Task 5)

**Phase 3 (Infrastructure — can parallel):**
- Task 5: Wallet Provider
- Task 6: Sponsor API
- Task 7: Transactions + Hooks
  - All three can run in parallel after Task 4

**Phase 4 (UI Implementation — can parallel):**
- Task 8: Merchant create (after Task 7)
- Task 9: QR components (after Task 5)
- Task 10: Merchant issue (after Task 7, 8, 9)
- Task 11: Customer view (after Task 7, 9)
  - Tasks 8, 9, 10, 11 can run in parallel (different pages)

**Phase 5 (Integration):**
- Task 12: Landing page (after Task 8, 11)
- Task 13: PWA + E2E test (after Task 12)

### Critical Path

1. Task 1 (Scaffolding): ~30 min
2. Task 2 (Move Core): ~1 hour
3. Task 4 (Deploy): ~30 min (blocks Tasks 5+)
4. Task 5 (Wallet): ~45 min
5. Task 7 (Transactions): ~1 hour
6. Task 8 (Merchant Create): ~1 hour
7. Task 9 (QR): ~45 min
8. Task 10 (Issue): ~1 hour
9. Task 11 (Customer): ~1 hour
10. Task 12 (Landing): ~30 min
11. Task 13 (PWA): ~30 min

**Estimated critical path:** 8-9 hours (assuming 2-3 days of implementation with testing/debugging)

---

## Risk Inventory

### Risk 1: Slush Wallet Friction (DESIGN SPEC — Lines 226-228)

**Description:** Customers need a Slush wallet before earning their first stamp. This is a friction point in the onboarding flow.

**Mitigation (Design Spec):**
- Onboarding screen guides new users to slush.org in 60 seconds
- Frame StampCard NFT as "your digital loyalty wallet"
- StampCard appearing immediately after first stamp is the hook

**Implementation Status:**
- Partially addressed: Task 1 PWA scaffolding includes PWA install prompt
- Task 12 (Landing page) should have Slush onboarding instructions
- **Gap:** No automated Slush iframe or in-app wallet creation in the plan

**Recommendation:**
- Task 12 should include Slush onboarding link and clear CTA
- Monitor user drop-off metrics on Vercel

---

### Risk 2: BSP Regulatory Exposure (DESIGN SPEC — Lines 230-232)

**Description:** USDC/USDsui cashback in v2 = moving value = potential VASP territory. Philippines BSP may classify cashback layer as VASP activity (Virtual Asset Service Provider).

**Mitigation (Design Spec):**
- MVP has zero token movement (stamps are NFTs, not money)
- For v2, partner with Coins.ph or PDAX as licensed off-ramp
- Do not handle fiat conversion directly

**Implementation Status:**
- MVP design fully avoids this (no token transfers, only NFT mutations)
- **Gap:** No legal review scheduled before launch
- **Gap:** No v2 partnership agreements documented

**Recommendation:**
- Engage compliance lawyer before launching (before applying for SUI Foundation grant)
- Document regulatory strategy in a separate Risk Mitigation doc
- This is a **launch blocker if targeting Filipino market**

---

### Risk 3: SUI Network Downtime (DESIGN SPEC — Lines 234-236)

**Description:** SUI outage = merchants can't issue stamps. Merchant experience breaks.

**Mitigation (Design Spec):**
- Stamp issuance queue with exponential backoff retry
- Show "pending" state, not error
- Resolve automatically when network recovers

**Implementation Status:**
- **NOT ADDRESSED in implementation plan**
- No task covers queue + retry logic
- Task 7 (Transactions) builds `buildIssueStamp()` but doesn't mention error handling

**Gap:** Missing Implementation Task
- Need Task 7b: "Add Retry Queue + Offline Resilience"
- Should implement: localStorage-based queue, exponential backoff, UI pending state

**Recommendation:**
- Add new task after Task 7: "Implement stamp issuance retry queue"
- Use something like TanStack React Query with retry config or custom queue
- Show visual "pending" badge on cards when tx is retrying

---

### Risk 4: Merchant Cold Start (DESIGN SPEC — Lines 238-240)

**Description:** Chicken-and-egg problem: no merchants = no customers; no customers = no merchants. Hard to bootstrap network.

**Mitigation (Design Spec):**
- Launch in one tight geography first (one city, one barangay)
- Target 20 merchants manually
- Density over breadth

**Implementation Status:**
- **NOT ADDRESSED in implementation plan**
- No task covers merchant recruitment, onboarding, community building

**Gap:** Missing Operations Work
- This is a **business/growth problem, not an engineering problem**
- Implementation plan is engineering-focused, not go-to-market
- Recommend: Create separate "Launch Operations Plan" doc

---

### Risk 5: Gas Station Depletion (DESIGN SPEC — Lines 242-244)

**Description:** Sponsored tx spike drains the sponsor wallet's gas budget. Free tier could run out.

**Mitigation (Design Spec):**
- Rate limit: 50 sponsored tx/merchant/day on free tier
- Premium removes cap
- Alert at 20% gas wallet balance remaining

**Implementation Status:**
- Task 6 (Sponsor API) mentions rate limiting but doesn't implement it
- No task covers: gas balance monitoring, alerts, cap enforcement

**Gap:** Missing Implementation Tasks
- Task 6b: "Add rate limiting + gas balance monitoring"
- Should implement:
  - Sponsor API checks remaining gas before accepting new tx
  - Tracks tx count per merchant per day
  - Returns 429 (Too Many Requests) when over limit
  - Admin dashboard to monitor gas wallet balance

**Recommendation:**
- Add to Task 6 or create Task 6b: rate limiting logic
- Use Supabase Postgres to track sponsor tx counts (if database is available)
- Or use simple in-memory counter with daily reset

---

### Risk 6: Smart Contract Bugs (DESIGN SPEC — Lines 246-248)

**Description:** Logic bug in `issue_stamp` or `redeem` could allow fake stamps or invalid redemptions.

**Mitigation (Design Spec):**
- Move's type system eliminates reentrancy and overflow by default
- Audit contracts before mainnet
- Full testnet launch with real merchants first

**Implementation Status:**
- Task 2 (Move Core) implements functions with assertions
- Task 3 (Tests) covers 7 test scenarios
- **Gap:** No formal audit scheduled
- **Gap:** No mainnet vs testnet deployment strategy documented

**Evaluation of Task 2 Code:**
- Access control: ✓ `assert!(program.merchant == ctx.sender(), ENotMerchant)`
- Invariant protection: ✓ `assert!(card.current_stamps >= program.stamps_required, ENotEnoughStamps)`
- No unsafe patterns: ✓ Move prohibits reentrancy, overflow by design
- Event logging: ✓ All state changes emit events for auditability

**Recommendation:**
- Testnet launch with 10-20 real merchants (Risk 4 overlap)
- Hire Move auditor from Sui Foundation's preferred list (ask SUI team)
- Budget: $10-30K for audit
- Document audit findings before mainnet deployment

---

### Risk 7: Shared Object Consensus Latency (DESIGN SPEC — Lines 1098-1103, but implicit risk)

**Description:** Shared objects require SUI consensus (~600ms) vs owned objects (~400ms). Visible delay in UI feedback.

**Mitigation (Design Spec implicit):**
- This is a known-but-accepted tradeoff
- 600ms latency is imperceptible for loyalty stamps (not real-time trading)
- Design choice: StampCard must be shared so merchants can mutate

**Implementation Status:**
- Architectural choice is sound
- **Gap:** UI should show "Stamp issued" feedback immediately (optimistic update) before waiting for finality

**Recommendation:**
- Task 10 (Merchant Issue Flow) should implement optimistic UI updates:
  - Show counter increment immediately
  - Revert if transaction fails
  - Show confirmation toast on finality

---

### Risk 8: Shared Object Wallet Display Limitation (DESIGN SPEC — Lines 1104-1107)

**Description:** Shared objects may not appear automatically in Slush wallet's "My NFTs" view. StampCard NFTs might not show in wallet.

**Mitigation (Design Spec):**
- Suiki PWA is the primary interface for viewing cards
- Wallet-native rendering is a post-MVP improvement

**Implementation Status:**
- Task 11 (Customer View) builds the Suiki PWA view
- **Gap:** No fallback if Slush doesn't render shared objects
- **Gap:** No testing plan for Slush wallet Display compatibility

**Recommendation:**
- Test StampCard display with Slush wallet during Task 3-4 phase (after deploy)
- If not rendering, create GitHub issue with Slush team
- Document in PWA: "View your cards in Suiki" (UX workaround)
- Post-MVP: investigate owned object pattern or Slush wallet PR

---

### Risk 9: QR Code Scanning Reliability (Not in Design Spec, but inherent to implementation)

**Description:** QR code scanning on mobile can fail due to lighting, blur, camera focus. No fallback.

**Mitigation (Not documented):**
- Implement manual address entry as fallback
- Copy-paste QR data from clipboard
- Display clear error messages

**Implementation Status:**
- Task 9 (QR Components) uses `html5-qrcode` library
- **Gap:** No documented fallback for failed scans

**Recommendation:**
- Task 9 should include: manual address entry form as alternative to QR
- Task 10 should show both QR scanner + address input
- Task 11 should show both merchant QR scanner + program ID search

---

### Risk 10: Mobile Browser Compatibility (PWA-specific)

**Description:** PWA only works on modern browsers (Chrome, Firefox). Safari on iOS has limited PWA support.

**Mitigation (Not documented):**
- Target Android first (larger market in Philippines)
- Safari PWA is post-MVP

**Implementation Status:**
- Task 1 configures `next-pwa` with iOS support
- **Gap:** No documented browser/device testing plan

**Recommendation:**
- Test on: Android Chrome, Android Firefox, iOS Safari
- Document known limitations (iOS PWA install prompt is different)
- Post-MVP: React Native mobile app for better iOS experience

---

## Verification Summary

| Check | Status | Notes |
|-------|--------|-------|
| Object model complete | ✓ | StampProgram, StampCard with all fields, abilities, relationships documented |
| Transaction flows mapped | ✓ | All 5 key functions: create_program, create_card_and_stamp, issue_stamp, redeem, update_program |
| QR data format clear | ✓ | Merchant QR, Customer QR, app resolution logic documented |
| File structure mapped | ✓ | All 23 files across 13 tasks with purposes |
| Task dependencies charted | ✓ | Critical path identified, parallel work opportunities noted |
| Risks from spec inventoried | ✓ | All 6 design spec risks + 4 additional implementation risks identified |
| Mitigations evaluated | ✓ | Current status, gaps, and recommendations for each risk |

---

## Key Technical Decisions

### 1. Shared vs Owned Objects for StampCard

**Decision:** StampCard is a **shared object**.

**Rationale:**
- Merchant must be able to increment `current_stamps` when issuing stamps
- Owned objects can only be mutated by the owner
- Shared objects allow both merchant and customer to mutate the same object
- Tradeoff: Consensus latency (~600ms vs ~400ms) is acceptable for loyalty stamps

### 2. Stamp Flow Direction

**Decision:** **Merchant scans customer QR** → merchant issues stamp (primary flow)

**Rationale:**
- Merchant's wallet signs the `issue_stamp` transaction
- Prevents customer self-stamping (no fraud)
- Merchant controls stamp issuance (payment gateway equivalent)

### 3. Display Standard for NFT Upgradeability

**Decision:** Use SUI's **Display standard** for mutable StampCard metadata.

**Rationale:**
- When merchant updates logo or name, all linked StampCards visually update automatically
- No re-minting required
- Enables use case: seasonal card redesigns

### 4. Gas Sponsorship Architecture

**Decision:** Separate sponsor wallet + API route + dual signatures.

**Rationale:**
- Removes friction for merchants and customers (zero gas fees)
- Centralized gas budget management
- Rate limiting prevents abuse (50 tx/day free tier)

### 5. Free Tier = 100% On-Chain

**Decision:** MVP stores all data on-chain (no database).

**Rationale:**
- Eliminates infrastructure costs for free tier
- Enables decentralized data ownership
- Simplifies deployment (Vercel-only, no Supabase needed)
- Premium tier adds optional database for analytics later

---

## Pre-Implementation Checklist

### Before Starting Task 1

- [ ] Node.js 18+ installed
- [ ] SUI CLI installed (`sui --version`)
- [ ] GitHub repo created (or this Docs folder committed)
- [ ] `.env.local` template ready

### Before Starting Task 2

- [ ] SUI Testnet faucet accessible
- [ ] `sui move` commands tested

### Before Starting Task 4

- [ ] Testnet wallet funded with SUI (~5 SUI recommended)
- [ ] Sponsor wallet address generated and funded

### Before Starting Task 5

- [ ] NEXT_PUBLIC_PACKAGE_ID available from Task 4
- [ ] Slush wallet browser extension available

### Before Starting UI Tasks (Task 8+)

- [ ] Figma mockups or UI spec reviewed
- [ ] Design system (Tailwind colors, spacing) locked in

---

## Related Documentation

- [[Suiki - Design Spec]] — Product vision, market context, tech stack, risks
- [[Suiki - Implementation Plan]] — Step-by-step task execution guide
- [[Philippines Blockchain Context]] — BSP regulations, market demographics
- [[SUI Ecosystem Research]] — TPS, finality, Gas Station, Display standard details

---

*Architecture Map created: 2026-03-25*
*Covers: Design Spec (complete) + Implementation Plan (all 13 tasks)*
*Status: Reference document for development team*
