---
title: "Suiki — Implementation Plan"
date: 2026-03-25
status: draft
tags:
  - project/suiki
  - blockchain/sui
  - type/implementation-plan
  - stage/planning
created: 2026-03-25
updated: 2026-03-25
---

# Suiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP web-first PWA where Filipino merchants create on-chain stamp loyalty programs and customers collect upgradeable NFT stamp cards — all on SUI blockchain with zero gas fees for end users.

**Architecture:** Next.js 16 PWA connects to SUI via `@mysten/dapp-kit-react` v2 + Slush wallet adapter. Move smart contracts define `StampProgram` (shared, merchant-owned) and `StampCard` (shared, customer-facing NFT with Display standard). A Next.js API route sponsors gas for all transactions. Merchants issue stamps by scanning customer QR codes; customers view and redeem stamps through the PWA.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, `@mysten/dapp-kit-react` v2, `@mysten/sui`, SUI Move, SUI Gas Station, `qrcode.react`, `html5-qrcode`, Vercel

**Spec:** [[Suiki - Design Spec]]

---

## File Structure

```
suiki/
├── move/suiki/
│   ├── Move.toml
│   ├── sources/
│   │   └── suiki.move              # StampProgram + StampCard + Display + events
│   └── tests/
│       └── suiki_tests.move        # test_scenario tests for all functions
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Landing page (choose merchant/customer)
│   │   ├── providers.tsx           # SUI + wallet + React Query providers
│   │   ├── api/sponsor/
│   │   │   └── route.ts            # Gas station sponsor endpoint
│   │   ├── merchant/
│   │   │   ├── page.tsx            # Merchant dashboard (my programs)
│   │   │   ├── create/page.tsx     # Create stamp program form
│   │   │   └── [programId]/
│   │   │       └── page.tsx        # Program detail + scan + issue
│   │   └── customer/
│   │       ├── page.tsx            # Stamp collection view
│   │       └── scan/page.tsx       # Scan merchant QR
│   ├── lib/
│   │   ├── constants.ts            # Package ID, network, object IDs
│   │   ├── sui-client.ts           # SuiClient singleton for server use
│   │   ├── transactions.ts         # Transaction builders (create, issue, redeem)
│   │   └── queries.ts              # On-chain queries (programs, cards, events)
│   ├── components/
│   │   ├── connect-wallet.tsx      # Wallet connect button wrapper
│   │   ├── qr-code.tsx             # QR code display component
│   │   ├── qr-scanner.tsx          # Camera QR scanner
│   │   ├── stamp-card-display.tsx  # Renders a single StampCard NFT
│   │   └── stamp-progress.tsx      # Visual progress bar (5/10 stamps)
│   └── hooks/
│       ├── use-my-programs.ts      # Fetch merchant's stamp programs
│       ├── use-my-cards.ts         # Fetch customer's stamp cards
│       └── use-sponsored-tx.ts     # Build + sponsor + sign + execute flow
├── public/
│   ├── manifest.json               # PWA manifest
│   └── icons/                      # PWA icons (192x192, 512x512)
├── .env.local                      # SPONSOR_PRIVATE_KEY, NEXT_PUBLIC_PACKAGE_ID
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

> [!info] Design decision: StampCard as shared object
> StampCards are **shared objects** so both the merchant (to issue stamps) and the customer (to redeem) can interact with them. Owned objects in SUI can only be used by the owner, which would prevent merchants from stamping customer-owned cards.
>
> **Tradeoff:** Shared objects go through consensus (slightly slower — ~600ms vs ~400ms). For a stamp card use case, this is imperceptible.
>
> **Limitation:** Shared objects may not appear automatically in Slush wallet's "My NFTs" view. The Suiki PWA is the primary interface for viewing cards. Wallet-native rendering is a post-MVP improvement.

> [!info] Design decision: Stamp flow direction
> **Merchant scans customer QR → issues stamp** (primary flow — merchant authorizes the stamp).
> **Customer scans merchant QR → views program info** (informational — sees stamp count, merchant details).
> Stamp issuance is always merchant-initiated because the merchant's wallet signs the `issue_stamp` transaction, preventing unauthorized self-stamping.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `suiki/package.json`
- Create: `suiki/next.config.ts`
- Create: `suiki/tailwind.config.ts`
- Create: `suiki/tsconfig.json`
- Create: `suiki/.env.local`

- [ ] **Step 1: Create Next.js project**

```bash
npx create-next-app@latest suiki \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
cd suiki
```

Expected: Project scaffolded with App Router, TypeScript, Tailwind.

- [ ] **Step 2: Install SUI + wallet dependencies**

```bash
npm install @mysten/sui @mysten/dapp-kit-react @tanstack/react-query
```

- [ ] **Step 3: Install QR + PWA dependencies**

```bash
npm install qrcode.react html5-qrcode @ducanh2912/next-pwa
```

- [ ] **Step 4: Configure PWA in next.config.ts**

```typescript
// next.config.ts
import './src/env.ts'; // validate env at build time
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
});

export default withPWA({
  reactStrictMode: true,
  // Turbopack is the default dev server in Next.js 16
  turbopack: {},
});
```

- [ ] **Step 5: Create .env.local template**

```bash
# .env.local
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x_PLACEHOLDER_AFTER_DEPLOY
SPONSOR_PRIVATE_KEY=_BASE64_ENCODED_ED25519_KEY
```

- [ ] **Step 6: Create PWA manifest**

```json
// public/manifest.json
{
  "name": "Suiki — Loyalty on SUI",
  "short_name": "Suiki",
  "description": "Merchant loyalty stamp cards powered by SUI blockchain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 7: Verify project runs**

```bash
npm run dev
```

Expected: Next.js dev server starts at http://localhost:3000.

- [ ] **Step 8: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold Next.js 16 project with SUI + PWA deps"
```

---

## Task 2: Move Smart Contract — Core Logic

**Files:**
- Create: `suiki/move/suiki/Move.toml`
- Create: `suiki/move/suiki/sources/suiki.move`

- [ ] **Step 1: Create Move project structure**

```bash
mkdir -p move/suiki/sources move/suiki/tests
```

- [ ] **Step 2: Write Move.toml**

```toml
# move/suiki/Move.toml
[package]
name = "suiki"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
suiki = "0x0"
```

- [ ] **Step 3: Write the smart contract**

```move
// move/suiki/sources/suiki.move
module suiki::suiki {
    use std::string::String;
    use sui::clock::Clock;
    use sui::event;
    use sui::package;
    use sui::display;

    // ===== Error codes =====
    const ENotMerchant: u64 = 0;
    const EProgramMismatch: u64 = 1;
    const ENotEnoughStamps: u64 = 2;
    const ENotCustomer: u64 = 3;

    // ===== One-Time Witness =====
    public struct SUIKI has drop {}

    // ===== Objects =====

    /// Shared object representing a merchant's loyalty stamp program.
    public struct StampProgram has key {
        id: UID,
        merchant: address,
        name: String,
        logo_url: String,
        stamps_required: u64,
        reward_description: String,
        total_issued: u64,
    }

    /// Shared object representing a customer's stamp card for a specific program.
    /// Acts as an upgradeable NFT via SUI Display standard.
    public struct StampCard has key {
        id: UID,
        program_id: ID,
        customer: address,
        merchant_name: String,
        merchant_logo: String,
        stamps_required: u64,
        current_stamps: u64,
        total_earned: u64,
        last_stamped: u64,
    }

    // ===== Events =====

    public struct ProgramCreated has copy, drop {
        program_id: ID,
        merchant: address,
        name: String,
    }

    public struct CardCreated has copy, drop {
        card_id: ID,
        program_id: ID,
        customer: address,
    }

    public struct StampIssued has copy, drop {
        card_id: ID,
        program_id: ID,
        customer: address,
        new_count: u64,
    }

    public struct StampRedeemed has copy, drop {
        card_id: ID,
        program_id: ID,
        customer: address,
        total_earned: u64,
    }

    public struct ProgramUpdated has copy, drop {
        program_id: ID,
        name: String,
        logo_url: String,
    }

    // ===== Init — set up Display for StampCard NFTs =====

    fun init(otw: SUIKI, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        let mut display = display::new_with_fields<StampCard>(
            &publisher,
            vector[
                std::string::utf8(b"name"),
                std::string::utf8(b"description"),
                std::string::utf8(b"image_url"),
                std::string::utf8(b"project_url"),
            ],
            vector[
                std::string::utf8(b"{merchant_name} Loyalty Card"),
                std::string::utf8(b"{current_stamps}/{stamps_required} stamps collected"),
                std::string::utf8(b"{merchant_logo}"),
                std::string::utf8(b"https://suiki.app"),
            ],
            ctx,
        );
        display::update_version(&mut display);

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(display, ctx.sender());
    }

    // ===== Public Functions =====

    /// Merchant creates a new stamp program. Becomes a shared object.
    public fun create_program(
        name: String,
        logo_url: String,
        stamps_required: u64,
        reward_description: String,
        ctx: &mut TxContext,
    ) {
        let program = StampProgram {
            id: object::new(ctx),
            merchant: ctx.sender(),
            name,
            logo_url,
            stamps_required,
            reward_description,
            total_issued: 0,
        };

        event::emit(ProgramCreated {
            program_id: object::id(&program),
            merchant: ctx.sender(),
            name: program.name,
        });

        transfer::share_object(program);
    }

    /// Merchant creates a stamp card for a new customer and issues the first stamp.
    public fun create_card_and_stamp(
        program: &mut StampProgram,
        customer: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);

        let card = StampCard {
            id: object::new(ctx),
            program_id: object::id(program),
            customer,
            merchant_name: program.name,
            merchant_logo: program.logo_url,
            stamps_required: program.stamps_required,
            current_stamps: 1,
            total_earned: 0,
            last_stamped: clock.timestamp_ms(),
        };

        program.total_issued = program.total_issued + 1;

        event::emit(CardCreated {
            card_id: object::id(&card),
            program_id: object::id(program),
            customer,
        });

        event::emit(StampIssued {
            card_id: object::id(&card),
            program_id: object::id(program),
            customer,
            new_count: 1,
        });

        transfer::share_object(card);
    }

    /// Merchant issues a stamp to an existing customer's card.
    public fun issue_stamp(
        program: &mut StampProgram,
        card: &mut StampCard,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(card.program_id == object::id(program), EProgramMismatch);

        card.current_stamps = card.current_stamps + 1;
        card.last_stamped = clock.timestamp_ms();
        program.total_issued = program.total_issued + 1;

        event::emit(StampIssued {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            new_count: card.current_stamps,
        });
    }

    /// Customer redeems stamps when they reach the required count.
    public fun redeem(
        program: &StampProgram,
        card: &mut StampCard,
        ctx: &TxContext,
    ) {
        assert!(card.customer == ctx.sender(), ENotCustomer);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        assert!(card.current_stamps >= program.stamps_required, ENotEnoughStamps);

        card.total_earned = card.total_earned + card.current_stamps;
        card.current_stamps = 0;

        event::emit(StampRedeemed {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            total_earned: card.total_earned,
        });
    }

    /// Merchant updates their program details (name, logo, reward).
    public fun update_program(
        program: &mut StampProgram,
        name: String,
        logo_url: String,
        reward_description: String,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        program.name = name;
        program.logo_url = logo_url;
        program.reward_description = reward_description;

        event::emit(ProgramUpdated {
            program_id: object::id(program),
            name,
            logo_url,
        });
    }

    // ===== Accessor functions (for tests and client queries) =====

    public fun program_merchant(p: &StampProgram): address { p.merchant }
    public fun program_name(p: &StampProgram): String { p.name }
    public fun program_stamps_required(p: &StampProgram): u64 { p.stamps_required }
    public fun program_total_issued(p: &StampProgram): u64 { p.total_issued }
    public fun program_logo_url(p: &StampProgram): String { p.logo_url }
    public fun program_reward_description(p: &StampProgram): String { p.reward_description }

    public fun card_program_id(c: &StampCard): ID { c.program_id }
    public fun card_customer(c: &StampCard): address { c.customer }
    public fun card_current_stamps(c: &StampCard): u64 { c.current_stamps }
    public fun card_total_earned(c: &StampCard): u64 { c.total_earned }
    public fun card_stamps_required(c: &StampCard): u64 { c.stamps_required }
    public fun card_last_stamped(c: &StampCard): u64 { c.last_stamped }
}
```

- [ ] **Step 4: Compile the contract**

```bash
cd move/suiki && sui move build
```

Expected: `BUILDING suiki` → `Build Successful`. Fix any compiler errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add move/
git commit -m "feat: add SUI Move contract — StampProgram + StampCard + Display"
```

---

## Task 3: Move Contract — Tests

**Files:**
- Create: `suiki/move/suiki/tests/suiki_tests.move`

- [ ] **Step 1: Write test file**

```move
// move/suiki/tests/suiki_tests.move
#[test_only]
module suiki::suiki_tests {
    use sui::test_scenario;
    use sui::clock;
    use std::string;
    use suiki::suiki::{Self, StampProgram, StampCard};

    const MERCHANT: address = @0xCAFE;
    const CUSTOMER: address = @0xBEEF;

    #[test]
    fun test_create_program() {
        let mut scenario = test_scenario::begin(MERCHANT);

        // Merchant creates a program
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            10,
            string::utf8(b"Free brewed coffee"),
            scenario.ctx(),
        );

        // Verify the program exists as a shared object
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            assert!(suiki::program_merchant(&program) == MERCHANT);
            assert!(suiki::program_stamps_required(&program) == 10);
            assert!(suiki::program_total_issued(&program) == 0);
            assert!(suiki::program_name(&program) == string::utf8(b"Kape ni Juan"));
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    fun test_create_card_and_stamp() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // Create program
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Merchant creates card for customer with first stamp
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            assert!(suiki::program_total_issued(&program) == 1);
            test_scenario::return_shared(program);
        };

        // Verify the card exists
        scenario.next_tx(CUSTOMER);
        {
            let card = test_scenario::take_shared<StampCard>(&scenario);
            assert!(suiki::card_customer(&card) == CUSTOMER);
            assert!(suiki::card_current_stamps(&card) == 1);
            assert!(suiki::card_total_earned(&card) == 0);
            assert!(suiki::card_stamps_required(&card) == 5);
            test_scenario::return_shared(card);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    fun test_issue_stamp() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // Create program
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Create card with first stamp
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Issue second stamp
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&mut program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            assert!(suiki::program_total_issued(&program) == 2);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    fun test_redeem() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let mut test_clock = clock::create_for_testing(scenario.ctx());

        // Create program (requires 3 stamps)
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            3,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Create card + first stamp
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Issue stamps 2 and 3
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            clock::increment_for_testing(&mut test_clock, 1000);
            suiki::issue_stamp(&mut program, &mut card, &test_clock, scenario.ctx());
            clock::increment_for_testing(&mut test_clock, 1000);
            suiki::issue_stamp(&mut program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 3);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // Customer redeems
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 0);
            assert!(suiki::card_total_earned(&card) == 3);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    fun test_non_merchant_cannot_stamp() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Non-merchant tries to issue stamp — should fail
        scenario.next_tx(CUSTOMER);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&mut program, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotEnoughStamps)]
    fun test_cannot_redeem_insufficient_stamps() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Customer tries to redeem with only 1 stamp (needs 5) — should fail
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    fun test_update_program() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Old Name"),
            string::utf8(b"https://old.com/logo.png"),
            5,
            string::utf8(b"Old reward"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::update_program(
                &mut program,
                string::utf8(b"New Name"),
                string::utf8(b"https://new.com/logo.png"),
                string::utf8(b"New reward"),
                scenario.ctx(),
            );
            assert!(suiki::program_name(&program) == string::utf8(b"New Name"));
            assert!(suiki::program_logo_url(&program) == string::utf8(b"https://new.com/logo.png"));
            test_scenario::return_shared(program);
        };

        scenario.end();
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd move/suiki && sui move test
```

Expected: All 6 tests pass — `test_create_program`, `test_create_card_and_stamp`, `test_issue_stamp`, `test_redeem`, `test_non_merchant_cannot_stamp`, `test_cannot_redeem_insufficient_stamps`, `test_update_program`.

- [ ] **Step 3: Fix any test failures and re-run**

If tests fail due to syntax issues, fix the contract and tests, then re-run `sui move test`.

- [ ] **Step 4: Commit**

```bash
git add move/suiki/tests/
git commit -m "test: add Move contract tests for all stamp functions"
```

---

## Task 4: Deploy Contract to SUI Testnet

**Files:**
- Modify: `suiki/.env.local` (update PACKAGE_ID)
- Modify: `suiki/move/suiki/Move.toml` (set published address)

> [!warning] Prerequisite
> You need the SUI CLI installed (`sui` command) and a funded testnet wallet. Run `sui client faucet` to get testnet SUI tokens.

- [ ] **Step 1: Verify active address has testnet SUI**

```bash
sui client active-address
sui client gas
```

If no gas objects, run `sui client faucet`.

- [ ] **Step 2: Publish the package to testnet**

```bash
cd move/suiki && sui client publish --gas-budget 100000000
```

Expected: Output contains `packageId` — save this value.

- [ ] **Step 3: Record the package ID**

Update `.env.local`:
```
NEXT_PUBLIC_PACKAGE_ID=0x_YOUR_ACTUAL_PACKAGE_ID
```

- [ ] **Step 4: Verify on SUI Explorer**

Open `https://suiexplorer.com/object/YOUR_PACKAGE_ID?network=testnet` and confirm the package is published with the `suiki` module.

- [ ] **Step 5: Commit**

```bash
git add .env.local
git commit -m "chore: deploy contract to SUI testnet, record package ID"
```

---

## Task 5: SUI Client + Wallet Provider

**Files:**
- Create: `suiki/src/lib/constants.ts`
- Create: `suiki/src/lib/sui-client.ts`
- Create: `suiki/src/app/providers.tsx`
- Create: `suiki/src/components/connect-wallet.tsx`
- Modify: `suiki/src/app/layout.tsx`

- [ ] **Step 1: Create constants**

```typescript
// src/lib/constants.ts
import { env } from '@/env';

export const SUI_NETWORK = env.NEXT_PUBLIC_SUI_NETWORK;
export const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID;
export const MODULE_NAME = 'suiki';

// Move function targets
export const TARGETS = {
  createProgram: `${PACKAGE_ID}::${MODULE_NAME}::create_program`,
  createCardAndStamp: `${PACKAGE_ID}::${MODULE_NAME}::create_card_and_stamp`,
  issueStamp: `${PACKAGE_ID}::${MODULE_NAME}::issue_stamp`,
  redeem: `${PACKAGE_ID}::${MODULE_NAME}::redeem`,
  updateProgram: `${PACKAGE_ID}::${MODULE_NAME}::update_program`,
} as const;

// SUI system objects
export const CLOCK_ID = '0x6';
```

- [ ] **Step 2: Create server-side SUI client**

```typescript
// src/lib/sui-client.ts
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { env } from '@/env';

const GRPC_URLS: Record<'testnet' | 'mainnet' | 'devnet', string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export const suiClient = new SuiGrpcClient({
  network: env.NEXT_PUBLIC_SUI_NETWORK,
  baseUrl: GRPC_URLS[env.NEXT_PUBLIC_SUI_NETWORK],
});
```

- [ ] **Step 3: Create providers wrapper**

```typescript
// src/app/providers.tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createDAppKit, DAppKitProvider } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

// gRPC endpoints per network (preferred over JSON-RPC per Mysten recommendation)
const GRPC_URLS: Record<'testnet' | 'mainnet' | 'devnet', string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet', 'devnet'] as const,
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

/** Root provider tree. QueryClientProvider wraps DAppKitProvider so blockchain
 * hooks can use React Query's cache for server data independently. */
export function Providers({ children }: { children: React.ReactNode }) {
  // useState factory prevents QueryClient from being shared across SSR requests
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Create wallet connect button**

```typescript
// src/components/connect-wallet.tsx
'use client';

import { ConnectButton } from '@mysten/dapp-kit-react';

export function ConnectWallet() {
  return <ConnectButton />;
}
```

- [ ] **Step 5: Update root layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Suiki — Loyalty on SUI',
  description: 'Merchant stamp card loyalty powered by SUI blockchain',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify wallet connects**

```bash
npm run dev
```

Open http://localhost:3000. The page should show a "Connect Wallet" button. Clicking it should show Slush wallet option.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ src/app/providers.tsx src/app/layout.tsx src/components/connect-wallet.tsx
git commit -m "feat: set up SUI client, wallet provider, and connect button"
```

---

## Task 6: Gas Station Sponsor API

**Files:**
- Create: `suiki/src/app/api/sponsor/route.ts`

> [!info] How gas sponsorship works
> 1. Client builds a transaction with `onlyTransactionKind: true` (just the commands, no gas info)
> 2. Sends the kind bytes to `/api/sponsor` along with the sender's address
> 3. API builds the full transaction: sets sender, gas owner (sponsor wallet), gas payment
> 4. API signs the gas portion with the sponsor keypair
> 5. Returns the full tx bytes + sponsor signature
> 6. Client signs with user's wallet, then submits both signatures

- [ ] **Step 1: Generate sponsor keypair for testnet**

```bash
sui keytool generate ed25519
```

Copy the private key (base64) to `.env.local` as `SPONSOR_PRIVATE_KEY`. Fund this address with testnet SUI:

```bash
sui client faucet --address YOUR_SPONSOR_ADDRESS
```

- [ ] **Step 2: Write the sponsor API route**

```typescript
// src/app/api/sponsor/route.ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { suiClient as client } from '@/lib/sui-client';

function getSponsorKeypair(): Ed25519Keypair {
  const key = process.env.SPONSOR_PRIVATE_KEY;
  if (!key) throw new Error('SPONSOR_PRIVATE_KEY not set');
  return Ed25519Keypair.fromSecretKey(fromBase64(key));
}

export async function POST(request: Request) {
  try {
    const { txKindBytes, sender } = await request.json();

    if (!txKindBytes || !sender) {
      return Response.json({ error: 'Missing txKindBytes or sender' }, { status: 400 });
    }

    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

    // Build sponsored transaction from kind bytes
    const tx = Transaction.fromKind(fromBase64(txKindBytes));
    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    // Build the full transaction
    const builtBytes = await tx.build({ client });

    // Sponsor signs the transaction
    const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(builtBytes);

    return Response.json({
      transactionBytes: toBase64(builtBytes),
      sponsorSignature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sponsorship failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Test the API route starts without errors**

```bash
npm run dev
```

Verify that `http://localhost:3000/api/sponsor` returns 400 with `{"error":"Missing txKindBytes or sender"}` when hit with an empty POST.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sponsor/
git commit -m "feat: add gas station sponsor API route"
```

---

## Task 7: Transaction Builders + Queries

**Files:**
- Create: `suiki/src/lib/transactions.ts`
- Create: `suiki/src/lib/queries.ts`
- Create: `suiki/src/hooks/use-sponsored-tx.ts`
- Create: `suiki/src/hooks/use-my-programs.ts`
- Create: `suiki/src/hooks/use-my-cards.ts`

- [ ] **Step 1: Write transaction builders**

```typescript
// src/lib/transactions.ts
import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID } from './constants';

export function buildCreateProgram(args: {
  name: string;
  logoUrl: string;
  stampsRequired: number;
  rewardDescription: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: TARGETS.createProgram,
    arguments: [
      tx.pure.string(args.name),
      tx.pure.string(args.logoUrl),
      tx.pure.u64(args.stampsRequired),
      tx.pure.string(args.rewardDescription),
    ],
  });
  return tx;
}

export function buildCreateCardAndStamp(args: {
  programId: string;
  customerAddress: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: TARGETS.createCardAndStamp,
    arguments: [
      tx.object(args.programId),
      tx.pure.address(args.customerAddress),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function buildIssueStamp(args: {
  programId: string;
  cardId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: TARGETS.issueStamp,
    arguments: [
      tx.object(args.programId),
      tx.object(args.cardId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function buildRedeem(args: {
  programId: string;
  cardId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: TARGETS.redeem,
    arguments: [
      tx.object(args.programId),
      tx.object(args.cardId),
    ],
  });
  return tx;
}
```

- [ ] **Step 2: Write on-chain queries**

```typescript
// src/lib/queries.ts
import { SuiClient } from '@mysten/sui/client';
import { PACKAGE_ID, MODULE_NAME } from './constants';

export interface StampProgramData {
  objectId: string;
  merchant: string;
  name: string;
  logoUrl: string;
  stampsRequired: number;
  rewardDescription: string;
  totalIssued: number;
}

export interface StampCardData {
  objectId: string;
  programId: string;
  customer: string;
  merchantName: string;
  merchantLogo: string;
  stampsRequired: number;
  currentStamps: number;
  totalEarned: number;
  lastStamped: number;
}

interface EventJson {
  program_id?: string;
  card_id?: string;
  merchant?: string;
  customer?: string;
  name?: string;
  [key: string]: unknown;
}

function parseProgram(obj: { objectId: string; content?: { fields?: Record<string, unknown> } }): StampProgramData | null {
  const fields = obj.content?.fields as Record<string, unknown> | undefined;
  if (!fields) return null;
  return {
    objectId: obj.objectId,
    merchant: fields.merchant as string,
    name: fields.name as string,
    logoUrl: fields.logo_url as string,
    stampsRequired: Number(fields.stamps_required),
    rewardDescription: fields.reward_description as string,
    totalIssued: Number(fields.total_issued),
  };
}

function parseCard(obj: { objectId: string; content?: { fields?: Record<string, unknown> } }): StampCardData | null {
  const fields = obj.content?.fields as Record<string, unknown> | undefined;
  if (!fields) return null;
  return {
    objectId: obj.objectId,
    programId: fields.program_id as string,
    customer: fields.customer as string,
    merchantName: fields.merchant_name as string,
    merchantLogo: fields.merchant_logo as string,
    stampsRequired: Number(fields.stamps_required),
    currentStamps: Number(fields.current_stamps),
    totalEarned: Number(fields.total_earned),
    lastStamped: Number(fields.last_stamped),
  };
}

/** Find all stamp programs created by a specific merchant. */
export async function fetchMerchantPrograms(client: SuiClient, merchantAddress: string): Promise<StampProgramData[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated` },
    order: 'descending',
  });

  const myEvents = events.data.filter(
    (e) => (e.parsedJson as EventJson)?.merchant === merchantAddress,
  );

  if (myEvents.length === 0) return [];

  const programIds = myEvents.map((e) => (e.parsedJson as EventJson).program_id!);
  const objects = await client.multiGetObjects({
    ids: programIds,
    options: { showContent: true },
  });

  return objects.map((o) => parseProgram({ objectId: o.data?.objectId ?? '', content: o.data?.content as { fields?: Record<string, unknown> } })).filter((p): p is StampProgramData => p !== null);
}

/** Find all stamp cards for a specific customer. */
export async function fetchCustomerCards(client: SuiClient, customerAddress: string): Promise<StampCardData[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated` },
    order: 'descending',
  });

  const myEvents = events.data.filter(
    (e) => (e.parsedJson as EventJson)?.customer === customerAddress,
  );

  if (myEvents.length === 0) return [];

  const cardIds = myEvents.map((e) => (e.parsedJson as EventJson).card_id!);
  const objects = await client.multiGetObjects({
    ids: cardIds,
    options: { showContent: true },
  });

  return objects.map((o) => parseCard({ objectId: o.data?.objectId ?? '', content: o.data?.content as { fields?: Record<string, unknown> } })).filter((c): c is StampCardData => c !== null);
}

/** Find a specific customer's card for a given program. */
export async function findCardForProgram(
  client: SuiClient,
  programId: string,
  customerAddress: string,
): Promise<StampCardData | null> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated` },
    order: 'descending',
  });

  const match = events.data.find(
    (e) => {
      const json = e.parsedJson as EventJson;
      return json?.program_id === programId && json?.customer === customerAddress;
    },
  );

  if (!match) return null;

  const cardId = (match.parsedJson as EventJson).card_id!;
  const obj = await client.getObject({ id: cardId, options: { showContent: true } });
  if (!obj.data) return null;

  return parseCard({ objectId: obj.data.objectId, content: obj.data.content as { fields?: Record<string, unknown> } });
}
```

- [ ] **Step 3: Write sponsored transaction hook**

```typescript
// src/hooks/use-sponsored-tx.ts
'use client';

import { useSignTransaction, useSuiClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { useCallback, useState } from 'react';

interface SponsorResponse {
  transactionBytes: string;
  sponsorSignature: string;
}

export function useSponsoredTransaction() {
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (tx: Transaction, senderAddress: string) => {
      setLoading(true);
      try {
        // Build kind bytes (commands only, no gas info)
        const kindBytes = await tx.build({ client, onlyTransactionKind: true });

        // Send to sponsor API
        const res = await fetch('/api/sponsor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txKindBytes: toBase64(kindBytes),
            sender: senderAddress,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Sponsorship failed');
        }

        const { transactionBytes, sponsorSignature }: SponsorResponse = await res.json();

        // User signs the sponsored transaction
        const { signature: userSignature } = await signTransaction({
          transaction: transactionBytes,
        });

        // Execute with both signatures
        const result = await client.executeTransactionBlock({
          transactionBlock: transactionBytes,
          signature: [userSignature, sponsorSignature],
          options: { showEffects: true, showEvents: true },
        });

        return result;
      } finally {
        setLoading(false);
      }
    },
    [client, signTransaction],
  );

  return { execute, loading };
}
```

- [ ] **Step 4: Write query hooks**

```typescript
// src/hooks/use-my-programs.ts
'use client';

import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMerchantPrograms } from '@/lib/queries';

export function useMyPrograms() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ['my-programs', account?.address],
    queryFn: () => fetchMerchantPrograms(client, account!.address),
    enabled: !!account?.address,
  });
}
```

```typescript
// src/hooks/use-my-cards.ts
'use client';

import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomerCards } from '@/lib/queries';

export function useMyCards() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ['my-cards', account?.address],
    queryFn: () => fetchCustomerCards(client, account!.address),
    enabled: !!account?.address,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactions.ts src/lib/queries.ts src/hooks/
git commit -m "feat: add transaction builders, on-chain queries, and sponsored tx hook"
```

---

## Task 8: Merchant — Create Stamp Program Page

**Files:**
- Create: `suiki/src/app/merchant/page.tsx`
- Create: `suiki/src/app/merchant/create/page.tsx`

- [ ] **Step 1: Write create program form**

```typescript
// src/app/merchant/create/page.tsx
'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useRouter } from 'next/navigation';
import { ConnectWallet } from '@/components/connect-wallet';
import { buildCreateProgram } from '@/lib/transactions';
import { useSponsoredTransaction } from '@/hooks/use-sponsored-tx';

export default function CreateProgramPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const { execute, loading } = useSponsoredTransaction();

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [stampsRequired, setStampsRequired] = useState(10);
  const [rewardDescription, setRewardDescription] = useState('');
  const [error, setError] = useState('');

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Connect your wallet to create a program</h1>
        <ConnectWallet />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name || !stampsRequired || !rewardDescription) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      const tx = buildCreateProgram({
        name,
        logoUrl,
        stampsRequired,
        rewardDescription,
      });
      await execute(tx, account!.address);
      router.push('/merchant');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Stamp Program</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Business Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kape ni Juan"
            className="border rounded-lg p-3 bg-gray-50"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Logo URL</span>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="border rounded-lg p-3 bg-gray-50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Stamps Required for Reward *</span>
          <input
            type="number"
            value={stampsRequired}
            onChange={(e) => setStampsRequired(Number(e.target.value))}
            min={1}
            max={100}
            className="border rounded-lg p-3 bg-gray-50"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Reward Description *</span>
          <input
            type="text"
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
            placeholder="e.g. Free brewed coffee"
            className="border rounded-lg p-3 bg-gray-50"
            required
          />
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg p-3 font-medium disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Program'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write merchant dashboard (list programs)**

```typescript
// src/app/merchant/page.tsx
'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import Link from 'next/link';
import { ConnectWallet } from '@/components/connect-wallet';
import { useMyPrograms } from '@/hooks/use-my-programs';

export default function MerchantDashboard() {
  const account = useCurrentAccount();
  const { data: programs, isLoading } = useMyPrograms();

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
        <p className="text-gray-500">Connect your wallet to manage stamp programs.</p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Programs</h1>
        <Link
          href="/merchant/create"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          + New
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading programs...</p>}

      {programs && programs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No programs yet.</p>
          <Link href="/merchant/create" className="text-blue-600 font-medium">
            Create your first stamp program
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {programs?.map((program) => (
          <Link
            key={program.objectId}
            href={`/merchant/${program.objectId}`}
            className="border rounded-lg p-4 flex items-center gap-3 hover:bg-gray-50"
          >
            {program.logoUrl && (
              <img
                src={program.logoUrl}
                alt={program.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium">{program.name}</h3>
              <p className="text-sm text-gray-500">
                {program.stampsRequired} stamps for: {program.rewardDescription}
              </p>
            </div>
            <span className="text-sm text-gray-400">{program.totalIssued} issued</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify create flow on testnet**

```bash
npm run dev
```

Open http://localhost:3000/merchant/create. Connect Slush wallet. Fill in form. Submit. Confirm transaction. Should redirect to `/merchant` and show the new program.

- [ ] **Step 4: Commit**

```bash
git add src/app/merchant/
git commit -m "feat: add merchant create program and dashboard pages"
```

---

## Task 9: QR Code Components

**Files:**
- Create: `suiki/src/components/qr-code.tsx`
- Create: `suiki/src/components/qr-scanner.tsx`

- [ ] **Step 1: Write QR code display component**

```typescript
// src/components/qr-code.tsx
'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  data: Record<string, string>;
  size?: number;
  label?: string;
}

export function QRCodeDisplay({ data, size = 256, label }: QRCodeDisplayProps) {
  const value = JSON.stringify(data);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-4 rounded-xl">
        <QRCodeSVG value={value} size={size} level="M" />
      </div>
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write QR scanner component**

```typescript
// src/components/qr-scanner.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: Record<string, string>) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function startScanning() {
    if (!containerRef.current) return;

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    setActive(true);

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            scanner.stop().catch(() => {});
            setActive(false);
            onScan(data);
          } catch {
            onError?.('Invalid QR code format');
          }
        },
        () => {}, // ignore scan failures (camera noise)
      );
    } catch (err) {
      setActive(false);
      onError?.(err instanceof Error ? err.message : 'Camera access denied');
    }
  }

  function stopScanning() {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setActive(false);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div id="qr-reader" ref={containerRef} className="w-full max-w-sm rounded-lg overflow-hidden" />
      {!active ? (
        <button
          onClick={startScanning}
          className="bg-blue-600 text-white rounded-lg px-6 py-3 font-medium"
        >
          Open Camera
        </button>
      ) : (
        <button
          onClick={stopScanning}
          className="bg-gray-600 text-white rounded-lg px-6 py-3 font-medium"
        >
          Stop Scanning
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/qr-code.tsx src/components/qr-scanner.tsx
git commit -m "feat: add QR code display and camera scanner components"
```

---

## Task 10: Merchant — Issue Stamp Flow

**Files:**
- Create: `suiki/src/app/merchant/[programId]/page.tsx`

> [!info] Stamp issuance flow
> 1. Merchant opens program detail page → sees their QR code + "Scan Customer" button
> 2. Merchant scans customer QR → gets customer wallet address
> 3. App queries events: does this customer already have a card?
> 4. If no → builds `create_card_and_stamp` tx. If yes → builds `issue_stamp` tx.
> 5. Transaction is sponsored → merchant signs → stamp issued
> 6. Shows success feedback

- [ ] **Step 1: Write program detail + stamp issuance page**

```typescript
// src/app/merchant/[programId]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectWallet } from '@/components/connect-wallet';
import { QRCodeDisplay } from '@/components/qr-code';
import { QRScanner } from '@/components/qr-scanner';
import { useSponsoredTransaction } from '@/hooks/use-sponsored-tx';
import { buildCreateCardAndStamp, buildIssueStamp } from '@/lib/transactions';
import { findCardForProgram, type StampProgramData } from '@/lib/queries';

export default function ProgramDetailPage() {
  const { programId } = useParams<{ programId: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const { execute, loading } = useSponsoredTransaction();

  const [mode, setMode] = useState<'qr' | 'scan'>('qr');
  const [status, setStatus] = useState<'idle' | 'stamping' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch program details
  const { data: program } = useQuery({
    queryKey: ['program', programId],
    queryFn: async () => {
      const obj = await client.getObject({ id: programId, options: { showContent: true } });
      if (!obj.data?.content) return null;
      const fields = (obj.data.content as { fields?: Record<string, unknown> }).fields;
      if (!fields) return null;
      return {
        objectId: obj.data.objectId,
        merchant: fields.merchant as string,
        name: fields.name as string,
        logoUrl: fields.logo_url as string,
        stampsRequired: Number(fields.stamps_required),
        rewardDescription: fields.reward_description as string,
        totalIssued: Number(fields.total_issued),
      } as StampProgramData;
    },
    enabled: !!programId,
  });

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Connect wallet</h1>
        <ConnectWallet />
      </div>
    );
  }

  async function handleCustomerScanned(data: Record<string, string>) {
    if (data.type !== 'customer' || !data.wallet_address) {
      setStatus('error');
      setStatusMessage('Invalid customer QR code.');
      return;
    }

    const customerAddress = data.wallet_address;
    setStatus('stamping');
    setStatusMessage(`Issuing stamp to ${customerAddress.slice(0, 8)}...`);

    try {
      // Check if customer already has a card
      const existingCard = await findCardForProgram(client, programId, customerAddress);

      let tx;
      if (existingCard) {
        tx = buildIssueStamp({ programId, cardId: existingCard.objectId });
      } else {
        tx = buildCreateCardAndStamp({ programId, customerAddress });
      }

      await execute(tx, account!.address);

      setStatus('success');
      setStatusMessage(
        existingCard
          ? `Stamp issued! (${existingCard.currentStamps + 1}/${program?.stampsRequired})`
          : 'First stamp! New card created.',
      );

      // Invalidate queries so data refreshes
      queryClient.invalidateQueries({ queryKey: ['program', programId] });
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to issue stamp');
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      {/* Program header */}
      <div className="flex items-center gap-3 mb-6">
        {program?.logoUrl && (
          <img src={program.logoUrl} alt={program.name} className="w-14 h-14 rounded-lg object-cover" />
        )}
        <div>
          <h1 className="text-xl font-bold">{program?.name ?? 'Loading...'}</h1>
          <p className="text-sm text-gray-500">
            {program?.stampsRequired} stamps → {program?.rewardDescription}
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode('qr'); setStatus('idle'); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${mode === 'qr' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
        >
          My QR Code
        </button>
        <button
          onClick={() => { setMode('scan'); setStatus('idle'); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${mode === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
        >
          Scan Customer
        </button>
      </div>

      {/* QR code mode: show merchant's QR for customers to scan */}
      {mode === 'qr' && (
        <div className="flex flex-col items-center">
          <QRCodeDisplay
            data={{ type: 'merchant', program_id: programId, wallet_address: account.address }}
            label="Customers scan this to view your program"
          />
        </div>
      )}

      {/* Scan mode: scan customer QR to issue stamp */}
      {mode === 'scan' && status === 'idle' && (
        <QRScanner
          onScan={handleCustomerScanned}
          onError={(err) => { setStatus('error'); setStatusMessage(err); }}
        />
      )}

      {/* Status feedback */}
      {status === 'stamping' && (
        <div className="text-center py-8">
          <p className="text-lg">{statusMessage}</p>
          <p className="text-gray-500 text-sm mt-2">Waiting for confirmation...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">&#10003;</p>
          <p className="text-lg font-medium text-green-600">{statusMessage}</p>
          <button
            onClick={() => { setStatus('idle'); setMode('scan'); }}
            className="mt-4 bg-blue-600 text-white rounded-lg px-6 py-2 font-medium"
          >
            Scan Next Customer
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-500">{statusMessage}</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-4 bg-gray-200 rounded-lg px-6 py-2 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 border-t pt-4">
        <p className="text-sm text-gray-500">Total stamps issued: {program?.totalIssued ?? 0}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test the full stamp issuance flow on testnet**

1. Open `/merchant/create` → create a program
2. Open `/merchant/{programId}` → see QR + "Scan Customer" button
3. On a second device (or second browser): connect a different wallet, open `/customer`, show the customer QR
4. Merchant scans customer QR → stamp should be issued

- [ ] **Step 3: Commit**

```bash
git add src/app/merchant/
git commit -m "feat: add merchant program detail page with stamp issuance flow"
```

---

## Task 11: Customer — Stamp Collection View

**Files:**
- Create: `suiki/src/components/stamp-card-display.tsx`
- Create: `suiki/src/components/stamp-progress.tsx`
- Create: `suiki/src/app/customer/page.tsx`
- Create: `suiki/src/app/customer/scan/page.tsx`

- [ ] **Step 1: Write stamp progress component**

```typescript
// src/components/stamp-progress.tsx
'use client';

interface StampProgressProps {
  current: number;
  required: number;
}

export function StampProgress({ current, required }: StampProgressProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Array.from({ length: required }, (_, i) => (
        <div
          key={i}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs
            ${i < current
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 text-gray-300'
            }`}
        >
          {i < current ? '\u2713' : i + 1}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write stamp card display component**

```typescript
// src/components/stamp-card-display.tsx
'use client';

import { StampProgress } from './stamp-progress';
import type { StampCardData } from '@/lib/queries';

interface StampCardDisplayProps {
  card: StampCardData;
  onRedeem?: () => void;
  redeemLoading?: boolean;
}

export function StampCardDisplay({ card, onRedeem, redeemLoading }: StampCardDisplayProps) {
  const canRedeem = card.currentStamps >= card.stampsRequired;

  return (
    <div className="border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {card.merchantLogo && (
          <img src={card.merchantLogo} alt={card.merchantName} className="w-10 h-10 rounded-lg object-cover" />
        )}
        <div className="flex-1">
          <h3 className="font-medium">{card.merchantName}</h3>
          <p className="text-sm text-gray-500">
            {card.currentStamps}/{card.stampsRequired} stamps
          </p>
        </div>
        {card.totalEarned > 0 && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
            {card.totalEarned} redeemed
          </span>
        )}
      </div>

      <StampProgress current={card.currentStamps} required={card.stampsRequired} />

      {canRedeem && onRedeem && (
        <button
          onClick={onRedeem}
          disabled={redeemLoading}
          className="bg-green-600 text-white rounded-lg py-2 font-medium text-sm disabled:opacity-50"
        >
          {redeemLoading ? 'Redeeming...' : 'Redeem Reward!'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write customer stamp collection page**

```typescript
// src/app/customer/page.tsx
'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import Link from 'next/link';
import { ConnectWallet } from '@/components/connect-wallet';
import { QRCodeDisplay } from '@/components/qr-code';
import { StampCardDisplay } from '@/components/stamp-card-display';
import { useMyCards } from '@/hooks/use-my-cards';
import { useSponsoredTransaction } from '@/hooks/use-sponsored-tx';
import { buildRedeem } from '@/lib/transactions';
import { useQueryClient } from '@tanstack/react-query';

export default function CustomerPage() {
  const account = useCurrentAccount();
  const { data: cards, isLoading } = useMyCards();
  const { execute, loading: redeemLoading } = useSponsoredTransaction();
  const queryClient = useQueryClient();
  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">My Stamp Cards</h1>
        <p className="text-gray-500">Connect your Slush wallet to see your stamps.</p>
        <ConnectWallet />
      </div>
    );
  }

  async function handleRedeem(cardId: string, programId: string) {
    setRedeemingCardId(cardId);
    try {
      const tx = buildRedeem({ programId, cardId });
      await execute(tx, account!.address);
      queryClient.invalidateQueries({ queryKey: ['my-cards'] });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setRedeemingCardId(null);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Stamp Cards</h1>
        <Link
          href="/customer/scan"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Scan Merchant
        </Link>
      </div>

      {/* Customer QR code */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <QRCodeDisplay
          data={{ type: 'customer', wallet_address: account.address }}
          size={180}
          label="Show this to merchants to earn stamps"
        />
      </div>

      {/* Stamp cards */}
      {isLoading && <p className="text-gray-500">Loading your cards...</p>}

      {cards && cards.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-2">No stamp cards yet.</p>
          <p className="text-sm text-gray-400">Visit a Suiki merchant and scan their QR code to get started!</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {cards?.map((card) => (
          <StampCardDisplay
            key={card.objectId}
            card={card}
            onRedeem={() => handleRedeem(card.objectId, card.programId)}
            redeemLoading={redeemLoading && redeemingCardId === card.objectId}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write scan merchant page**

```typescript
// src/app/customer/scan/page.tsx
'use client';

import { useState } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useRouter } from 'next/navigation';
import { ConnectWallet } from '@/components/connect-wallet';
import { QRScanner } from '@/components/qr-scanner';
import type { StampProgramData } from '@/lib/queries';
import { findCardForProgram } from '@/lib/queries';

export default function ScanMerchantPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const [program, setProgram] = useState<StampProgramData | null>(null);
  const [myStamps, setMyStamps] = useState<number>(0);
  const [error, setError] = useState('');

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <ConnectWallet />
      </div>
    );
  }

  async function handleMerchantScanned(data: Record<string, string>) {
    if (data.type !== 'merchant' || !data.program_id) {
      setError('Invalid merchant QR code.');
      return;
    }

    try {
      // Fetch program details
      const obj = await client.getObject({ id: data.program_id, options: { showContent: true } });
      const fields = (obj.data?.content as { fields?: Record<string, unknown> })?.fields;
      if (!fields) {
        setError('Program not found.');
        return;
      }

      const programData: StampProgramData = {
        objectId: obj.data!.objectId,
        merchant: fields.merchant as string,
        name: fields.name as string,
        logoUrl: fields.logo_url as string,
        stampsRequired: Number(fields.stamps_required),
        rewardDescription: fields.reward_description as string,
        totalIssued: Number(fields.total_issued),
      };
      setProgram(programData);

      // Check if customer has a card
      const card = await findCardForProgram(client, data.program_id, account!.address);
      setMyStamps(card?.currentStamps ?? 0);
    } catch {
      setError('Failed to load program.');
    }
  }

  if (program) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <div className="border rounded-xl p-6 text-center">
          {program.logoUrl && (
            <img src={program.logoUrl} alt={program.name} className="w-16 h-16 rounded-lg mx-auto mb-3 object-cover" />
          )}
          <h2 className="text-xl font-bold">{program.name}</h2>
          <p className="text-gray-500 mt-1">{program.stampsRequired} stamps for: {program.rewardDescription}</p>
          <div className="mt-4 bg-blue-50 rounded-lg p-3">
            <p className="text-blue-700 font-medium">
              You have {myStamps}/{program.stampsRequired} stamps
            </p>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Ask the merchant to scan your QR code to earn a stamp!
          </p>
          <button
            onClick={() => router.push('/customer')}
            className="mt-4 bg-gray-200 rounded-lg px-6 py-2 font-medium"
          >
            Back to My Cards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Scan Merchant QR</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <QRScanner onScan={handleMerchantScanned} onError={setError} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stamp-card-display.tsx src/components/stamp-progress.tsx src/app/customer/
git commit -m "feat: add customer stamp collection view, scan merchant, and redeem flow"
```

---

## Task 12: Landing Page + Navigation

**Files:**
- Modify: `suiki/src/app/page.tsx`
- Modify: `suiki/src/app/layout.tsx`

- [ ] **Step 1: Write landing page**

```typescript
// src/app/page.tsx
'use client';

import Link from 'next/link';
import { ConnectWallet } from '@/components/connect-wallet';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Suiki</h1>
        <p className="text-gray-500 text-lg">Loyalty stamps powered by SUI blockchain</p>
      </div>

      <ConnectWallet />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/merchant"
          className="bg-blue-600 text-white rounded-xl p-4 text-center font-medium text-lg"
        >
          I&apos;m a Merchant
        </Link>
        <Link
          href="/customer"
          className="bg-white border-2 border-blue-600 text-blue-600 rounded-xl p-4 text-center font-medium text-lg"
        >
          I&apos;m a Customer
        </Link>
      </div>

      <p className="text-xs text-gray-400 text-center max-w-sm">
        Stamps are NFTs on SUI. You own them — they can&apos;t be revoked, never expire, and live in your wallet.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Add navigation bar to layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Suiki — Loyalty on SUI',
  description: 'Merchant stamp card loyalty powered by SUI blockchain',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white min-h-screen">
        <Providers>
          <nav className="border-b px-4 py-3 flex justify-between items-center">
            <Link href="/" className="font-bold text-lg">Suiki</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/merchant" className="text-gray-600 hover:text-gray-900">Merchant</Link>
              <Link href="/customer" className="text-gray-600 hover:text-gray-900">Customer</Link>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify navigation works**

```bash
npm run dev
```

Navigate between `/`, `/merchant`, `/customer`, `/merchant/create`, `/customer/scan`. All links should work.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add landing page and navigation bar"
```

---

## Task 13: PWA Finalization + End-to-End Test

**Files:**
- Create: `suiki/public/icons/icon-192.png`
- Create: `suiki/public/icons/icon-512.png`
- Verify: `suiki/public/manifest.json`

- [ ] **Step 1: Generate PWA icons**

Create simple placeholder icons (192x192 and 512x512 PNG) with the letter "S" on a blue background. Use any image editor or generator like https://favicon.io.

Place them at:
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

- [ ] **Step 2: Build and verify PWA**

```bash
npm run build
npm run start
```

Open http://localhost:3000 in Chrome. Open DevTools → Application → Manifest. Verify the PWA manifest loads correctly with the right name, icons, and start URL.

- [ ] **Step 3: End-to-end testnet test**

Full flow checklist:

1. **Merchant creates program:** `/merchant/create` → fill form → submit → see it on `/merchant`
2. **Merchant views program:** `/merchant/{id}` → see QR code + "Scan Customer" button
3. **Customer views their QR:** `/customer` → see QR code
4. **Merchant scans customer:** Use second browser/device. Merchant scans customer QR → stamp issued → success message
5. **Customer sees stamp:** Customer refreshes `/customer` → sees the new StampCard with 1 stamp
6. **Repeat stamps:** Merchant scans same customer multiple times → stamp count increases
7. **Customer redeems:** When stamp count meets requirement → "Redeem" button appears → customer taps → stamps reset to 0, total_earned increments

- [ ] **Step 4: Fix any issues found during testing**

Address any bugs discovered during the E2E test.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: finalize PWA config and complete MVP"
```

---

## Post-MVP Notes

> [!tip] Grant application
> With the working testnet MVP, apply to the **SUI Foundation $50M Developer Grant** ($10K–$100K). Include a demo video showing the full stamp flow.

> [!tip] Mainnet launch prep
> Before mainnet:
> - Get the Move contract audited (OtterSec, MoveBit, or Zellic for Move audits)
> - Update `NEXT_PUBLIC_SUI_NETWORK` to `mainnet`
> - Re-publish the contract on mainnet
> - Fund the sponsor wallet with real SUI
> - Set up gas budget monitoring and rate limiting

> [!tip] Next features (from roadmap)
> See [[Suiki - Design Spec#Roadmap]] for post-MVP, V2, and long-term features.

---

*Plan written: 2026-03-25*
*Status: Awaiting review*
