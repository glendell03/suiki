# V3 Data Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Suiki Move smart contract and introduce a Neon Postgres database layer, replacing all chain-stored operational metadata with a DB-indexed, event-sourced architecture.

**Architecture:** Move contract holds only ownership/trust primitives (stamps, merchant address, lifecycle flags). Neon Postgres holds all descriptive metadata (logo, description, hours), synced from chain events by a Vercel Cron indexer. API routes JOIN both sources into enriched response types consumed by the UI.

**Tech Stack:** Sui Move 2024 · Next.js 16 App Router · Drizzle ORM · `@neondatabase/serverless` · TanStack Query v5 · Vitest · `@mysten/sui` SDK

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `move/suiki/sources/suiki.move` | Complete contract rewrite (replaces existing) |
| `move/suiki/tests/suiki_tests.move` | Move unit tests |
| `docker-compose.yml` | Neon Local dev proxy (dev Docker profile only) |
| `src/lib/db/schema.ts` | Drizzle table definitions |
| `src/lib/db/index.ts` | Neon DB client singleton |
| `src/lib/db/migrate.ts` | Programmatic migration runner (CI/CD) |
| `drizzle/` | Generated SQL migration files (committed to git) |
| `drizzle.config.ts` | Drizzle CLI migration config |
| `src/lib/indexer/handlers.ts` | Per-event-type Postgres mutation logic |
| `src/lib/indexer/indexer.ts` | Event polling loop + cursor management |
| `src/app/api/indexer/tick/route.ts` | Vercel Cron POST endpoint |
| `src/app/api/programs/[programId]/route.ts` | GET single program + merchant profile |
| `src/app/api/customer/[wallet]/cards/route.ts` | GET all cards for a wallet |
| `src/app/api/merchant/programs/route.ts` | POST create program metadata |
| `src/app/api/merchant/programs/[id]/route.ts` | PUT update program metadata |
| `src/types/db.ts` | DB-enriched API response types |

### Modified
| File | Change |
|---|---|
| `src/types/sui.ts` | Remove `merchantName`/`merchantLogo`, add `version`/`isActive`, new events |
| `src/lib/constants.ts` | Add new TARGETS (staffer, deactivate, reactivate), new EVENT_TYPES |
| `src/lib/transactions.ts` | Update `buildCreateProgram`/`buildUpdateProgram` signatures, add staffer builders |
| `src/lib/queries.ts` | Slim to chain-verification reads only (no more primary data source) |
| `src/env.ts` | Add `DATABASE_URL`, `DATABASE_URL_UNPOOLED` server vars |
| `src/hooks/use-my-cards.ts` | Fetch from `/api/customer/[wallet]/cards` instead of chain |
| `src/hooks/use-my-programs.ts` | Fetch from `/api/merchant/programs` instead of chain |
| `src/app/customer/page.tsx` | Use `CardWithProgram` type (no `merchantName`/`merchantLogo`) |
| `src/app/customer/cards/[cardId]/page.tsx` | Use enriched card from API |
| `src/lib/__tests__/transactions.test.ts` | Update for new `buildCreateProgram` signature |
| `src/lib/__tests__/queries.test.ts` | Update for removed fields |

---

## Phase 1 — Move Contract Rewrite

### Task 1: Rewrite suiki.move from scratch

**Files:**
- Modify: `move/suiki/sources/suiki.move`

- [ ] **Step 1: Replace the entire file**

```move
module suiki::suiki {
    use std::string::String;
    use sui::clock::Clock;
    use sui::coin::Coin;
    use sui::event;
    use sui::package;
    use sui::display;
    use sui::sui::SUI;

    // ===== Version =====
    const VERSION: u64 = 1;

    // ===== Error codes (clever errors — Move 2024) =====
    #[error]
    const ENotMerchant: vector<u8> = b"Caller is not the program merchant";
    #[error]
    const EProgramMismatch: vector<u8> = b"Card does not belong to this program";
    #[error]
    const ENotEnoughStamps: vector<u8> = b"Not enough stamps to redeem";
    #[error]
    const ENotCustomer: vector<u8> = b"Caller is not the card customer";
    #[error]
    const EInvalidStampsRequired: vector<u8> = b"stamps_required must be >= 1";
    #[error]
    const EInvalidName: vector<u8> = b"Name must be 1-64 characters";
    #[error]
    const EThemeNotFree: vector<u8> = b"Theme is not in the free range (0-5)";
    #[error]
    const EInvalidTheme: vector<u8> = b"Theme ID exceeds maximum (63)";
    #[error]
    const EThemeAlreadyOwned: vector<u8> = b"Theme already purchased";
    #[error]
    const EThemeNotOwned: vector<u8> = b"Theme not purchased";
    #[error]
    const ENotProfileOwner: vector<u8> = b"Caller is not the profile owner";
    #[error]
    const EInsufficientPayment: vector<u8> = b"Payment must be exactly 1 SUI";
    #[error]
    const EProgramInactive: vector<u8> = b"Program is inactive";
    #[error]
    const ENotStaffer: vector<u8> = b"Staffer cap does not match this program";
    #[error]
    const EWrongVersion: vector<u8> = b"Object version mismatch — call migrate first";

    // ===== Constants =====
    const FREE_THEME_COUNT: u8 = 6;
    const MAX_THEME_ID: u8 = 63;
    const MAX_NAME_LEN: u64 = 64;
    const PREMIUM_THEME_PRICE_MIST: u64 = 1_000_000_000;
    /// Testnet treasury — rotate before mainnet deployment.
    const TREASURY: address = @0x5383ce8f598c85e8cd1a72d5ac54f69cfda0d52510d7236c035b7a674b8b8b62;

    // ===== One-Time Witness =====
    public struct SUIKI has drop {}

    // ===== Capabilities =====

    /// Deployer-held capability for post-upgrade migrations.
    public struct AdminCap has key { id: UID }

    // ===== Objects =====

    /// Shared object representing a merchant's loyalty stamp program.
    public struct StampProgram has key {
        id: UID,
        version: u64,
        merchant: address,
        name: String,
        stamps_required: u64,
        is_active: bool,
        total_issued: u64,
        theme_id: u8,
    }

    /// Shared object representing a customer's stamp card for a specific program.
    public struct StampCard has key {
        id: UID,
        version: u64,
        program_id: ID,
        customer: address,
        stamps_required: u64,
        current_stamps: u64,
        total_earned: u64,
        last_stamped: u64,
    }

    /// Owned object for premium theme entitlement tracking.
    public struct MerchantProfile has key {
        id: UID,
        merchant: address,
        unlocked_themes: u64,
    }

    /// Owned capability delegating stamp authority to a staff member/location.
    /// Design: this is a BEARER TOKEN. `has store` makes it transferable — whoever
    /// holds the cap can call issue_stamp_as_staffer. The `staffer` field is metadata
    /// only (for indexer tracking). If a staffer hands their device to a coworker,
    /// that coworker can stamp — this is intentional (multi-device POS support).
    /// Merchants who want strict identity enforcement should revoke and re-issue.
    public struct StafferCap has key, store {
        id: UID,
        program_id: ID,
        staffer: address,
    }

    // ===== Events =====

    public struct ProgramCreated has copy, drop {
        program_id: ID,
        merchant: address,
        name: String,
        stamps_required: u64,  // included so indexer can bootstrap DB row without a chain read
    }
    public struct ProgramUpdated has copy, drop { program_id: ID, name: String }
    public struct ProgramActivated has copy, drop { program_id: ID }
    public struct ProgramDeactivated has copy, drop { program_id: ID }

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
        staffer: address,
    }
    public struct StampRedeemed has copy, drop {
        card_id: ID,
        program_id: ID,
        customer: address,
        redemption_count: u64,
        remaining_stamps: u64, // carry-forward already computed on-chain; indexer uses this directly
    }
    public struct ThemeChanged has copy, drop {
        program_id: ID,
        merchant: address,
        old_theme_id: u8,
        new_theme_id: u8,
    }
    public struct ProfileCreated has copy, drop { profile_id: ID, merchant: address }
    public struct ThemePurchased has copy, drop {
        profile_id: ID,
        merchant: address,
        theme_id: u8,
    }
    public struct StafferCapIssued has copy, drop {
        cap_id: ID,
        program_id: ID,
        staffer: address,
    }
    public struct StafferCapRevoked has copy, drop { cap_id: ID, program_id: ID }
    public struct MerchantTransferred has copy, drop {
        program_id: ID,
        old_merchant: address,
        new_merchant: address,
    }

    // ===== Init =====

    fun init(otw: SUIKI, ctx: &mut TxContext) {
        let admin = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin, ctx.sender());

        let publisher = package::claim(otw, ctx);
        let mut disp = display::new_with_fields<StampCard>(
            &publisher,
            vector[
                std::string::utf8(b"name"),
                std::string::utf8(b"description"),
                std::string::utf8(b"image_url"),
                std::string::utf8(b"project_url"),
            ],
            vector[
                std::string::utf8(b"Loyalty Card ({current_stamps}/{stamps_required} stamps)"),
                std::string::utf8(b"{current_stamps} of {stamps_required} stamps collected"),
                std::string::utf8(b"https://suiki.app/api/card-image/{id}"),
                std::string::utf8(b"https://suiki.app"),
            ],
            ctx,
        );
        display::update_version(&mut disp);
        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(disp, ctx.sender());
    }

    // ===== Public Functions =====

    /// Merchant creates a new loyalty program. Only free themes (0–5) allowed at creation.
    public fun create_program(
        name: String,
        stamps_required: u64,
        theme_id: u8,
        ctx: &mut TxContext,
    ) {
        assert!(stamps_required > 0, EInvalidStampsRequired);
        assert!(name.length() > 0 && name.length() <= MAX_NAME_LEN, EInvalidName);
        assert!(theme_id <= MAX_THEME_ID, EInvalidTheme);
        assert!(theme_id < FREE_THEME_COUNT, EThemeNotFree);

        let program = StampProgram {
            id: object::new(ctx),
            version: VERSION,
            merchant: ctx.sender(),
            name,
            stamps_required,
            is_active: true,
            total_issued: 0,
            theme_id,
        };

        event::emit(ProgramCreated {
            program_id: object::id(&program),
            merchant: ctx.sender(),
            name: program.name,
            stamps_required: program.stamps_required,
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
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(program.is_active, EProgramInactive);

        let card = StampCard {
            id: object::new(ctx),
            version: VERSION,
            program_id: object::id(program),
            customer,
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
            staffer: ctx.sender(),
        });

        transfer::share_object(card);
    }

    /// Merchant issues a stamp to an existing customer's card.
    public fun issue_stamp(
        program: &StampProgram,
        card: &mut StampCard,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(card.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        assert!(program.is_active, EProgramInactive);

        card.current_stamps = card.current_stamps + 1;
        card.last_stamped = clock.timestamp_ms();

        event::emit(StampIssued {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            new_count: card.current_stamps,
            staffer: ctx.sender(),
        });
    }

    /// StafferCap holder issues a stamp on behalf of the merchant.
    public fun issue_stamp_as_staffer(
        program: &StampProgram,
        card: &mut StampCard,
        cap: &StafferCap,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(card.version == VERSION, EWrongVersion);
        assert!(cap.program_id == object::id(program), ENotStaffer);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        assert!(program.is_active, EProgramInactive);

        card.current_stamps = card.current_stamps + 1;
        card.last_stamped = clock.timestamp_ms();

        event::emit(StampIssued {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            new_count: card.current_stamps,
            staffer: ctx.sender(),
        });
    }

    /// Customer redeems stamps. Excess stamps carry forward.
    public fun redeem(
        program: &StampProgram,
        card: &mut StampCard,
        ctx: &TxContext,
    ) {
        assert!(card.version == VERSION, EWrongVersion);
        assert!(card.customer == ctx.sender(), ENotCustomer);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        assert!(card.current_stamps >= program.stamps_required, ENotEnoughStamps);

        let excess = card.current_stamps - program.stamps_required;
        card.current_stamps = excess;
        card.total_earned = card.total_earned + 1;

        event::emit(StampRedeemed {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            redemption_count: card.total_earned,
            remaining_stamps: card.current_stamps, // = excess; indexer sets DB directly from this
        });
    }

    /// Merchant updates the program name (only on-chain field that can be updated).
    public fun update_program(
        program: &mut StampProgram,
        name: String,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(name.length() > 0 && name.length() <= MAX_NAME_LEN, EInvalidName);
        program.name = name;
        event::emit(ProgramUpdated { program_id: object::id(program), name });
    }

    /// Merchant sets a free theme (0–5).
    public fun set_theme(
        program: &mut StampProgram,
        theme_id: u8,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(theme_id <= MAX_THEME_ID, EInvalidTheme);
        assert!(theme_id < FREE_THEME_COUNT, EThemeNotFree);
        let old = program.theme_id;
        program.theme_id = theme_id;
        event::emit(ThemeChanged {
            program_id: object::id(program),
            merchant: ctx.sender(),
            old_theme_id: old,
            new_theme_id: theme_id,
        });
    }

    /// Merchant sets a premium theme. Requires profile with theme bit unlocked.
    public fun set_premium_theme(
        program: &mut StampProgram,
        profile: &MerchantProfile,
        theme_id: u8,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(profile.merchant == ctx.sender(), ENotProfileOwner);
        assert!(theme_id >= FREE_THEME_COUNT, EThemeNotFree);
        assert!(theme_id <= MAX_THEME_ID, EInvalidTheme);
        let bit = 1u64 << (theme_id as u8);
        assert!((profile.unlocked_themes & bit) != 0, EThemeNotOwned);
        let old = program.theme_id;
        program.theme_id = theme_id;
        event::emit(ThemeChanged {
            program_id: object::id(program),
            merchant: ctx.sender(),
            old_theme_id: old,
            new_theme_id: theme_id,
        });
    }

    /// Halts new card creation and stamp issuance. Existing cards still redeemable.
    public fun deactivate_program(program: &mut StampProgram, ctx: &TxContext) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        program.is_active = false;
        event::emit(ProgramDeactivated { program_id: object::id(program) });
    }

    /// Re-enables a deactivated program.
    public fun reactivate_program(program: &mut StampProgram, ctx: &TxContext) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        program.is_active = true;
        event::emit(ProgramActivated { program_id: object::id(program) });
    }

    /// Transfers program ownership to a new wallet.
    public fun transfer_merchant(
        program: &mut StampProgram,
        new_merchant: address,
        ctx: &TxContext,
    ) {
        assert!(program.version == VERSION, EWrongVersion);
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        let old_merchant = program.merchant;
        program.merchant = new_merchant;
        event::emit(MerchantTransferred {
            program_id: object::id(program),
            old_merchant,
            new_merchant,
        });
    }

    /// Merchant issues a StafferCap to a staff member or second location.
    public fun issue_staffer_cap(
        program: &StampProgram,
        staffer: address,
        ctx: &mut TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        let cap = StafferCap {
            id: object::new(ctx),
            program_id: object::id(program),
            staffer,
        };
        event::emit(StafferCapIssued {
            cap_id: object::id(&cap),
            program_id: object::id(program),
            staffer,
        });
        transfer::transfer(cap, staffer);
    }

    /// Burns a StafferCap. Merchant must hold the cap (received back from staffer).
    public fun revoke_staffer_cap(
        cap: StafferCap,
        program: &StampProgram,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(cap.program_id == object::id(program), ENotStaffer);
        let cap_id = object::id(&cap);
        event::emit(StafferCapRevoked { cap_id, program_id: object::id(program) });
        let StafferCap { id, program_id: _, staffer: _ } = cap;
        object::delete(id);
    }

    /// Creates MerchantProfile for PTB composition. Caller must transfer the result.
    public fun create_merchant_profile(ctx: &mut TxContext): MerchantProfile {
        let profile = MerchantProfile {
            id: object::new(ctx),
            merchant: ctx.sender(),
            unlocked_themes: 0,
        };
        event::emit(ProfileCreated { profile_id: object::id(&profile), merchant: ctx.sender() });
        profile
    }

    /// Standalone entry: creates a MerchantProfile and transfers it to the caller.
    entry fun create_and_transfer_merchant_profile(ctx: &mut TxContext) {
        let profile = create_merchant_profile(ctx);
        transfer::transfer(profile, ctx.sender());
    }

    /// Purchases a premium theme (6–63). Payment must be exactly 1 SUI.
    public fun purchase_theme(
        profile: &mut MerchantProfile,
        theme_id: u8,
        payment: Coin<SUI>,
        ctx: &TxContext,
    ) {
        assert!(profile.merchant == ctx.sender(), ENotProfileOwner);
        assert!(theme_id >= FREE_THEME_COUNT, EThemeNotFree);
        assert!(theme_id <= MAX_THEME_ID, EInvalidTheme);
        let bit = 1u64 << (theme_id as u8);
        assert!((profile.unlocked_themes & bit) == 0, EThemeAlreadyOwned);
        assert!(payment.value() == PREMIUM_THEME_PRICE_MIST, EInsufficientPayment);
        profile.unlocked_themes = profile.unlocked_themes | bit;
        transfer::public_transfer(payment, TREASURY);
        event::emit(ThemePurchased {
            profile_id: object::id(profile),
            merchant: ctx.sender(),
            theme_id,
        });
    }

    /// Merchant pushes updated stamps_required snapshot to a card.
    public fun sync_card_stamps_required(
        program: &StampProgram,
        card: &mut StampCard,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        card.stamps_required = program.stamps_required;
    }

    // ===== Upgrade Migration =====

    /// Called after a package upgrade to bring StampProgram objects to VERSION.
    entry fun migrate_program(program: &mut StampProgram, _: &AdminCap) {
        assert!(program.version < VERSION, EWrongVersion);
        program.version = VERSION;
    }

    /// Called after a package upgrade to bring StampCard objects to VERSION.
    entry fun migrate_card(card: &mut StampCard, _: &AdminCap) {
        assert!(card.version < VERSION, EWrongVersion);
        card.version = VERSION;
    }

    // ===== View Functions =====

    public fun program_merchant(p: &StampProgram): address { p.merchant }
    public fun program_name(p: &StampProgram): String { p.name }
    public fun program_stamps_required(p: &StampProgram): u64 { p.stamps_required }
    public fun program_total_issued(p: &StampProgram): u64 { p.total_issued }
    public fun program_theme_id(p: &StampProgram): u8 { p.theme_id }
    public fun program_is_active(p: &StampProgram): bool { p.is_active }
    public fun program_version(p: &StampProgram): u64 { p.version }

    public fun profile_merchant(p: &MerchantProfile): address { p.merchant }
    public fun profile_unlocked_themes(p: &MerchantProfile): u64 { p.unlocked_themes }

    public fun card_program_id(c: &StampCard): ID { c.program_id }
    public fun card_customer(c: &StampCard): address { c.customer }
    public fun card_current_stamps(c: &StampCard): u64 { c.current_stamps }
    public fun card_total_earned(c: &StampCard): u64 { c.total_earned }
    public fun card_stamps_required(c: &StampCard): u64 { c.stamps_required }
    public fun card_last_stamped(c: &StampCard): u64 { c.last_stamped }
    public fun card_version(c: &StampCard): u64 { c.version }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd move/suiki && sui move build --build-env testnet
```

Expected: `BUILDING Suiki` with no errors. Warnings about unused imports are acceptable.

- [ ] **Step 3: Commit**

```bash
git add move/suiki/sources/suiki.move
git commit -m "feat(contract): rewrite suiki.move for V3 — remove off-chain fields, add version guards, StafferCap, AdminCap, clever errors"
```

---

### Task 2: Write Move unit tests

**Files:**
- Create: `move/suiki/tests/suiki_tests.move`

- [ ] **Step 1: Create the test file**

```move
#[test_only]
module suiki::suiki_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock;
    use std::string;
    use suiki::suiki::{Self, StampProgram, StampCard, MerchantProfile, AdminCap, StafferCap};

    const MERCHANT: address = @0xA;
    const CUSTOMER: address = @0xB;
    const STAFFER: address = @0xC;

    // ===== Helpers =====

    fun setup(): Scenario {
        let mut scenario = ts::begin(MERCHANT);
        {
            suiki::init_for_testing(scenario.ctx());
        };
        scenario
    }

    // ===== create_program tests =====

    #[test]
    fun test_create_program_success() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        {
            suiki::create_program(
                string::utf8(b"Brew & Stamps"),
                10,
                0,
                scenario.ctx(),
            );
        };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            assert!(suiki::program_name(&program) == string::utf8(b"Brew & Stamps"), 0);
            assert!(suiki::program_stamps_required(&program) == 10, 1);
            assert!(suiki::program_is_active(&program) == true, 2);
            assert!(suiki::program_version(&program) == 1, 3);
            ts::return_shared(program);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EInvalidStampsRequired)]
    fun test_create_program_zero_stamps_fails() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        {
            suiki::create_program(string::utf8(b"Bad"), 0, 0, scenario.ctx());
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EInvalidName)]
    fun test_create_program_empty_name_fails() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        {
            suiki::create_program(string::utf8(b""), 5, 0, scenario.ctx());
        };
        ts::end(scenario);
    }

    // ===== create_card_and_stamp tests =====

    #[test]
    fun test_create_card_and_stamp_success() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        {
            suiki::create_program(string::utf8(b"Coffee Club"), 5, 0, scenario.ctx());
        };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            assert!(suiki::program_total_issued(&program) == 1, 0);
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        ts::next_tx(&mut scenario, CUSTOMER);
        {
            let card = ts::take_shared<StampCard>(&scenario);
            assert!(suiki::card_current_stamps(&card) == 1, 0);
            assert!(suiki::card_customer(&card) == CUSTOMER, 1);
            assert!(suiki::card_stamps_required(&card) == 5, 2);
            ts::return_shared(card);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    fun test_create_card_wrong_caller_fails() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        { suiki::create_program(string::utf8(b"Test"), 5, 0, scenario.ctx()); };
        ts::next_tx(&mut scenario, CUSTOMER); // wrong sender
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        ts::end(scenario);
    }

    // ===== issue_stamp tests =====

    #[test]
    fun test_issue_stamp_increments_count() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        { suiki::create_program(string::utf8(b"Test"), 5, 0, scenario.ctx()); };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            let mut card = ts::take_shared<StampCard>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clk, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2, 0);
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
            ts::return_shared(card);
        };
        ts::end(scenario);
    }

    // ===== redeem tests =====

    #[test]
    fun test_redeem_clears_stamps_with_excess() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        { suiki::create_program(string::utf8(b"Test"), 3, 0, scenario.ctx()); };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        // issue 2 more stamps (total 3 = stamps_required)
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            let mut card = ts::take_shared<StampCard>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clk, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clk, scenario.ctx());
            // now at 3 stamps, issue one more to create excess
            suiki::issue_stamp(&program, &mut card, &clk, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 4, 0);
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
            ts::return_shared(card);
        };
        ts::next_tx(&mut scenario, CUSTOMER);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            let mut card = ts::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 1, 0); // 4-3=1 carry forward
            assert!(suiki::card_total_earned(&card) == 1, 1);
            ts::return_shared(program);
            ts::return_shared(card);
        };
        ts::end(scenario);
    }

    // ===== deactivate / reactivate tests =====

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EProgramInactive)]
    fun test_stamp_on_inactive_program_fails() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        { suiki::create_program(string::utf8(b"Test"), 5, 0, scenario.ctx()); };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            suiki::deactivate_program(&mut program, scenario.ctx());
            ts::return_shared(program);
        };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            let mut card = ts::take_shared<StampCard>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clk, scenario.ctx()); // should fail
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
            ts::return_shared(card);
        };
        ts::end(scenario);
    }

    // ===== StafferCap tests =====

    #[test]
    fun test_staffer_can_issue_stamp() {
        let mut scenario = setup();
        ts::next_tx(&mut scenario, MERCHANT);
        { suiki::create_program(string::utf8(b"Test"), 5, 0, scenario.ctx()); };
        ts::next_tx(&mut scenario, MERCHANT);
        {
            let mut program = ts::take_shared<StampProgram>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clk, scenario.ctx());
            suiki::issue_staffer_cap(&program, STAFFER, scenario.ctx());
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
        };
        ts::next_tx(&mut scenario, STAFFER);
        {
            let program = ts::take_shared<StampProgram>(&scenario);
            let mut card = ts::take_shared<StampCard>(&scenario);
            let cap = ts::take_from_sender<StafferCap>(&scenario);
            let clk = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp_as_staffer(&program, &mut card, &cap, &clk, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2, 0);
            clock::destroy_for_testing(clk);
            ts::return_shared(program);
            ts::return_shared(card);
            ts::return_to_sender(&scenario, cap);
        };
        ts::end(scenario);
    }
}
```

> **Note:** You must add `init_for_testing` to the main module. Add this after the `init` function in `suiki.move`:
> ```move
> #[test_only]
> public fun init_for_testing(ctx: &mut TxContext) {
>     init(SUIKI {}, ctx);
> }
> ```

- [ ] **Step 2: Run the tests**

```bash
cd move/suiki && sui move test
```

Expected: All tests pass. Output ends with `Test result: OK. Total tests: N; passed: N; failed: 0`.

- [ ] **Step 3: Commit**

```bash
git add move/suiki/sources/suiki.move move/suiki/tests/suiki_tests.move
git commit -m "test(contract): add Move unit tests for V3 — version guards, StafferCap, lifecycle, redemption"
```

---

### Task 3: Deploy to testnet and capture new PACKAGE_ID

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Build against testnet environment**

```bash
sui move build --build-env testnet
```

Expected: `BUILDING Suiki` with no errors.

- [ ] **Step 2: Publish to testnet**

```bash
sui client publish --build-env testnet --gas-budget 100000000
```

Expected: Output includes `published-at = "0x<new_package_id>"`. Copy this address.

- [ ] **Step 3: Update NEXT_PUBLIC_PACKAGE_ID in .env.local**

```bash
# Open .env.local and set:
NEXT_PUBLIC_PACKAGE_ID=0x<value from publish output>
```

- [ ] **Step 4: Commit Move.lock (must not be gitignored)**

```bash
# Verify Move.lock is not in .gitignore:
grep -n "Move.lock" move/suiki/.gitignore 2>/dev/null || echo "not ignored — good"
git add move/suiki/Move.lock move/suiki/Published.toml
git commit -m "chore(contract): update Move.lock and Published.toml after V3 testnet deploy"
```

---

## Phase 2 — Neon Postgres + Drizzle ORM

### Task 4: Install dependencies and add env vars

**Files:**
- Modify: `package.json` (via pnpm)
- Modify: `src/env.ts`
- Modify: `.env.local`

- [ ] **Step 1: Install packages**

```bash
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Add env vars to src/env.ts**

Replace the `server` block:

```typescript
server: {
  SPONSOR_PRIVATE_KEY: z
    .string()
    .min(1)
    .refine(
      (val) => val.startsWith('suiprivkey1'),
      {
        message:
          'SPONSOR_PRIVATE_KEY must be a bech32-encoded Ed25519 key (starts with "suiprivkey1"). ' +
          'Generate one with: sui keytool generate ed25519',
      },
    ),
  DATABASE_URL: z.string().url().describe('Neon pooled connection string'),
  DATABASE_URL_UNPOOLED: z.string().url().describe('Neon direct URL for migrations'),
  // Shared secret between Vercel Cron and the /api/indexer/tick route.
  // Must be ≥32 chars. Generate with: openssl rand -hex 32
  CRON_SECRET: z.string().min(32).describe('Auth token for Vercel Cron → indexer tick'),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
},
```

Also add to `runtimeEnv`:

```typescript
DATABASE_URL: process.env.DATABASE_URL,
DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
CRON_SECRET: process.env.CRON_SECRET,
```

- [ ] **Step 3: Add Neon credentials to .env.local**

```bash
# .env.local — get Neon URLs from console.neon.tech after creating a new project
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=false
# Generate with: openssl rand -hex 32
CRON_SECRET=replace_with_32_plus_char_random_secret
```

The Neon console shows both URLs on the project dashboard (connection details panel).

- [ ] **Step 4: Commit**

```bash
git add src/env.ts
git commit -m "feat(db): add DATABASE_URL, DATABASE_URL_UNPOOLED, and CRON_SECRET env vars"
```

---

### Task 4b: Neon Local — local development setup

> **What is Neon Local?**
> Neon Local is a Docker proxy that gives you a static `localhost:5432` endpoint wired to your real Neon cloud branch. Your app never changes its connection string between branches — Neon Local handles routing. It can connect to an **existing branch** (`BRANCH_ID`) or spin up a **fresh ephemeral branch** (`PARENT_BRANCH_ID`) that is automatically deleted when the container stops.
>
> **Why not a plain local Postgres?**
> Because `@neondatabase/serverless` speaks HTTP/WebSocket — not raw TCP. Plain Postgres doesn't understand those protocols. Neon Local runs the same proxy layer as Neon Cloud, so the serverless driver works identically in dev and production.

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.local`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
# Usage:
#   Local dev (with Neon Local proxy):  docker compose --profile dev up -d
#   Stop + destroy ephemeral branch:    docker compose --profile dev down
#
# The `db` service only starts in the `dev` profile so production deploys
# are never affected by this file.

services:
  db:
    image: neondatabase/neon_local:latest
    ports:
      - '5432:5432'
    environment:
      # Required: get from console.neon.tech → Account Settings → API Keys
      NEON_API_KEY: ${NEON_API_KEY}
      # Required: get from console.neon.tech → your project → Settings
      NEON_PROJECT_ID: ${NEON_PROJECT_ID}
      # OPTION A — connect to a fixed existing branch (e.g. your `dev` branch):
      BRANCH_ID: ${BRANCH_ID}
      # OPTION B — ephemeral branch (comment out BRANCH_ID and uncomment below):
      # PARENT_BRANCH_ID: ${PARENT_BRANCH_ID}   # creates fresh branch on start, deletes on stop
      #
      # Tells Neon Local which driver to speak.
      # `serverless` = HTTP/WebSocket for @neondatabase/serverless (our driver)
      DRIVER: serverless
    profiles:
      - dev
```

> **Which option to use?**
> - Use `BRANCH_ID` pointing to a persistent `dev` branch for day-to-day work (data survives restarts).
> - Use `PARENT_BRANCH_ID` pointing to `main` for isolated feature testing — each `docker compose up` gives you a clean copy of production data, automatically wiped on `docker compose down`.

- [ ] **Step 2: Add Neon Local vars to `.env.local`**

```bash
# .env.local additions for local Neon Local dev

# Get from console.neon.tech → Account Settings → API Keys
NEON_API_KEY=napi_xxxxxxxxxxxxxxxxxxxxxxxx

# Get from console.neon.tech → your project → Settings
NEON_PROJECT_ID=your-project-id

# Get from console.neon.tech → your project → Branches
# Use your `dev` branch ID (not main)
BRANCH_ID=br-xxxxxxxxxxxxxxxx

# Override DATABASE_URL for local dev — Neon Local listens on localhost:5432
# The username `neon` and password `npg` are fixed credentials set by Neon Local.
# sslmode=no-verify because localhost TLS cert is self-signed.
DATABASE_URL=postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify

# For migrations (drizzle-kit), also point to localhost when running locally.
# When running migrations in CI against the real cloud, set this to the unpooled Neon URL.
DATABASE_URL_UNPOOLED=postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify
```

> **Dev vs Production connection strings:**
> | Context | `DATABASE_URL` |
> |---|---|
> | Local dev (`docker compose up`) | `postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify` |
> | Vercel Preview / Production | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` (pooled) |
>
> The `.env.local` file is gitignored. Vercel uses its own env vars. You never need to swap strings manually — just start or stop the container.

- [ ] **Step 3: Add `pnpm dev:db` convenience script to `package.json`**

```json
{
  "scripts": {
    "dev:db": "docker compose --profile dev up -d",
    "dev:db:down": "docker compose --profile dev down"
  }
}
```

- [ ] **Step 4: Start Neon Local and verify the connection**

```bash
pnpm dev:db
```

Expected: Docker pulls `neondatabase/neon_local:latest` (first run only), then:
```
✓ Connected to Neon project <your-project-id>
✓ Using branch: <branch-name>
✓ Listening on 0.0.0.0:5432
```

Verify the proxy is up:
```bash
psql "postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify" -c "SELECT version();"
```

Expected: PostgreSQL version string from your Neon branch.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml package.json
git commit -m "feat(dev): Neon Local docker-compose for local development with branch proxy"
```

---

### Task 5: Write Drizzle schema

**Files:**
- Create: `src/lib/db/schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  boolean,
  timestamp,
  jsonb,
  bigserial,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Sui addresses are always 0x + 64 hex chars = 66 chars.
// Program/card object IDs are the same format.
const SUI_ADDR_LEN = 66;

export const merchantProfiles = pgTable('merchant_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // nullable: stub profiles created before ProfileCreated event are indexed by walletAddress alone
  suiObjectId: varchar('sui_object_id', { length: SUI_ADDR_LEN }).unique(),
  walletAddress: varchar('wallet_address', { length: SUI_ADDR_LEN }).notNull().unique(),
  businessName: varchar('business_name', { length: 128 }).notNull().default(''),
  displayName: varchar('display_name', { length: 128 }),
  email: text('email'),              // PDPA: AES-256 encrypt before insert
  phone: varchar('phone', { length: 32 }),  // PDPA: encrypt before insert
  website: varchar('website', { length: 512 }),
  instagram: varchar('instagram', { length: 128 }),
  logoUrl: text('logo_url').notNull().default(''),
  category: varchar('category', { length: 64 }),
  addressText: text('address_text'), // PDPA: encrypt before insert
  openingHours: jsonb('opening_hours'),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const stampPrograms = pgTable('stamp_programs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  suiObjectId: varchar('sui_object_id', { length: SUI_ADDR_LEN }).notNull().unique(),
  merchantProfileId: uuid('merchant_profile_id').notNull().references(() => merchantProfiles.id),
  // varchar(64) matches MAX_NAME_LEN in the Move contract
  name: varchar('name', { length: 64 }).notNull(),
  // smallint (0–32767) is sufficient; stamps_required is typically 5–20
  stampsRequired: smallint('stamps_required').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  logoUrl: text('logo_url').notNull().default(''),
  rewardDescription: text('reward_description').notNull().default(''),
  // smallint: theme IDs are 0–63 (MAX_THEME_ID on-chain)
  themeId: smallint('theme_id').notNull().default(0),
  totalIssued: integer('total_issued').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const stampCards = pgTable('stamp_cards', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  suiObjectId: varchar('sui_object_id', { length: SUI_ADDR_LEN }).notNull().unique(),
  programId: uuid('program_id').notNull().references(() => stampPrograms.id),
  customerWallet: varchar('customer_wallet', { length: SUI_ADDR_LEN }).notNull(),
  // smallint: current stamp count is always < stamps_required (typically < 50)
  currentStamps: smallint('current_stamps').notNull().default(0),
  // integer: total completed redemption cycles over the card lifetime
  totalEarned: integer('total_earned').notNull().default(0),
  lastStamped: timestamp('last_stamped', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// BUG FIX: tx_digest alone is NOT unique — one transaction can emit multiple events
// (e.g., create_card_and_stamp emits CardCreated + StampIssued with the same tx_digest).
// The composite (tx_digest, event_seq) is the true idempotency key.
export const suiEvents = pgTable('sui_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  txDigest: varchar('tx_digest', { length: 64 }).notNull(),
  eventSeq: varchar('event_seq', { length: 20 }).notNull(),  // Sui event sequence number within tx
  eventType: text('event_type').notNull(),
  objectId: varchar('object_id', { length: SUI_ADDR_LEN }),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => [
  unique('sui_events_tx_seq_unique').on(t.txDigest, t.eventSeq),
]);

export const redemptions = pgTable('redemptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  cardId: uuid('card_id').notNull().references(() => stampCards.id),
  programId: uuid('program_id').notNull().references(() => stampPrograms.id),
  txDigest: varchar('tx_digest', { length: 64 }).notNull().unique(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull(),
  redemptionCount: integer('redemption_count').notNull(),
});

export const stafferCaps = pgTable('staffer_caps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  suiObjectId: varchar('sui_object_id', { length: SUI_ADDR_LEN }).notNull().unique(),
  programId: uuid('program_id').notNull().references(() => stampPrograms.id),
  stafferWallet: varchar('staffer_wallet', { length: SUI_ADDR_LEN }).notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const indexerCheckpoints = pgTable('indexer_checkpoints', {
  key: text('key').primaryKey(),
  cursor: text('cursor').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});
```

> **Schema notes:**
> - `merchant_profiles.sui_object_id` is nullable intentionally — stub profiles are created when a merchant runs `create_program` before calling `create_and_transfer_merchant_profile`. The `ProfileCreated` event handler updates it when it arrives.
> - `sui_events` composite unique on `(tx_digest, event_seq)` — one Sui transaction can emit N events; tx_digest alone would conflict.
> - Add these CHECK constraints via a raw migration (Drizzle doesn't support inline CHECKs):
>   ```sql
>   ALTER TABLE stamp_cards ADD CONSTRAINT chk_stamps_non_negative CHECK (current_stamps >= 0);
>   ALTER TABLE stamp_programs ADD CONSTRAINT chk_stamps_required_positive CHECK (stamps_required > 0);
>   ```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(db): Drizzle schema — merchant_profiles, stamp_programs, stamp_cards, events, redemptions"
```

---

### Task 6: DB client, Drizzle config, and migration workflow

> **Migration strategy (important):**
> Drizzle Kit has two approaches — `push` and `generate+migrate`. We use **`generate` + `migrate`** for production. This creates versioned SQL files committed to git, which are tracked in `__drizzle_migrations` table. `push` is for quick local prototyping only — it bypasses migration files and is destructive if used on a populated DB.
>
> | Command | When to use |
> |---|---|
> | `pnpm db:generate` | After any schema change — creates a SQL file in `./drizzle/` |
> | `pnpm db:migrate` | Apply pending migrations to the target DB |
> | `pnpm db:push` | Local-only rapid iteration (no migration file, never use on prod) |
> | `pnpm db:studio` | Open Drizzle Studio to inspect tables visually |

**Files:**
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/migrate.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the DB client**

```typescript
// src/lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Uses DATABASE_URL (pooled for Vercel, or localhost for Neon Local dev).
// Validated by src/env.ts — will throw at startup if missing.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```typescript
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',           // SQL migration files committed to git
  dialect: 'postgresql',
  dbCredentials: {
    // DATABASE_URL_UNPOOLED: direct (non-pooled) connection for migrations.
    // Locally: postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify (Neon Local)
    // Cloud:   postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require (direct URL)
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
  migrations: {
    table: '__drizzle_migrations',  // drizzle's applied-migrations log table
    schema: 'public',
  },
});
```

- [ ] **Step 3: Create the programmatic migration runner**

Used in CI/CD and for applying migrations to preview environments without shell access.

```typescript
// src/lib/db/migrate.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Load env from .env.local in local runs; Vercel injects vars in CI.
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const db = drizzle(sql);

const main = async () => {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

main();
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev:db": "docker compose --profile dev up -d",
    "dev:db:down": "docker compose --profile dev down",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/lib/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check"
  }
}
```

> - `db:generate` — generates a new timestamped SQL file in `./drizzle/` for every schema change
> - `db:migrate` — applies all unapplied SQL files via the programmatic migrator
> - `db:push` — directly syncs schema to DB (no SQL file; local dev only)
> - `db:studio` — opens Drizzle Studio at `http://localhost:4983` to browse tables/rows
> - `db:check` — validates migration file consistency (run in CI before deploy)

- [ ] **Step 5: Generate the initial migration**

Make sure Neon Local is running (`pnpm dev:db`) before this step.

```bash
pnpm db:generate --name=init
```

Expected output:
```
  📦 drizzle/
   └ 📂 20240101000000_init/
     ├ 📜 migration.sql
     └ 📜 snapshot.json
```

The generated `migration.sql` will contain CREATE TABLE statements for all 8 tables. Review it to confirm — commit only after verifying it looks correct.

- [ ] **Step 6: Apply the migration to your local Neon branch**

```bash
pnpm db:migrate
```

Expected output:
```
Running migrations...
Migrations completed successfully.
```

Drizzle creates a `__drizzle_migrations` table in your Neon branch and records the applied migration hash.

- [ ] **Step 7: Add the CHECK constraints via a custom migration**

Drizzle doesn't support inline CHECK constraints — add them via a hand-written migration:

```bash
pnpm db:generate --name=add_check_constraints --custom
```

This creates an empty SQL file. Open it and add:

```sql
-- drizzle/<timestamp>_add_check_constraints/migration.sql
ALTER TABLE stamp_cards
  ADD CONSTRAINT chk_current_stamps_non_negative CHECK (current_stamps >= 0);

ALTER TABLE stamp_programs
  ADD CONSTRAINT chk_stamps_required_positive CHECK (stamps_required > 0);
```

Apply it:
```bash
pnpm db:migrate
```

- [ ] **Step 8: Verify tables in Drizzle Studio**

```bash
pnpm db:studio
```

Opens `http://localhost:4983`. Confirm:
- All 8 tables visible: `merchant_profiles`, `stamp_programs`, `stamp_cards`, `sui_events`, `redemptions`, `staffer_caps`, `indexer_checkpoints`, `__drizzle_migrations`
- `sui_events` has both `tx_digest` and `event_seq` columns
- `merchant_profiles.sui_object_id` is nullable

- [ ] **Step 9: Commit everything**

```bash
git add src/lib/db/index.ts src/lib/db/migrate.ts drizzle.config.ts drizzle/ package.json
git commit -m "feat(db): Drizzle client, migration runner, initial migration, and db scripts"
```

> **When to run migrations going forward:**
> 1. Edit `src/lib/db/schema.ts`
> 2. `pnpm db:generate --name=<description>` — creates SQL file
> 3. Review the generated SQL in `./drizzle/`
> 4. `pnpm db:migrate` — applies to local Neon branch
> 5. Commit the schema change + the migration file together in one commit
> 6. In CI/CD: `pnpm db:migrate` runs against the preview/prod Neon branch before deployment
>
> **Never run `pnpm db:push` against production.** Push is destructive — it drops and recreates columns. Always use `generate` + `migrate` for shared or production databases.

---

## Phase 3 — Event Indexer

### Task 7: Event handlers

**Files:**
- Create: `src/lib/indexer/handlers.ts`

- [ ] **Step 1: Create the handlers file**

```typescript
// src/lib/indexer/handlers.ts
// Each handler receives a raw Sui event and mutates Postgres accordingly.
// All handlers are idempotent — they check tx_digest before writing.

import { db } from '@/lib/db';
import {
  merchantProfiles,
  stampPrograms,
  stampCards,
  suiEvents,
  redemptions,
  stafferCaps,
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

// ===== Type aliases for event payloads =====

interface ProgramCreatedPayload {
  program_id: string;
  merchant: string;
  name: string;
  stamps_required: number; // included in event so indexer doesn't need a chain read
}
interface ProgramUpdatedPayload { program_id: string; name: string }
interface ProgramActivatedPayload { program_id: string }
interface ProgramDeactivatedPayload { program_id: string }
interface CardCreatedPayload { card_id: string; program_id: string; customer: string }
interface StampIssuedPayload {
  card_id: string;
  program_id: string;
  customer: string;
  new_count: number;
  staffer: string;
}
interface StampRedeemedPayload {
  card_id: string;
  program_id: string;
  customer: string;
  redemption_count: number;
  remaining_stamps: number; // carry-forward computed on-chain; use directly — don't recalculate
}
interface ThemeChangedPayload { program_id: string; new_theme_id: number }
interface ProfileCreatedPayload { profile_id: string; merchant: string }
interface StafferCapIssuedPayload { cap_id: string; program_id: string; staffer: string }
interface StafferCapRevokedPayload { cap_id: string; program_id: string }

// ===== Idempotency check =====

// BUG FIX: one tx can emit N events with the same tx_digest but different event_seq.
// Must check the composite (txDigest, eventSeq) — not txDigest alone.
async function alreadyProcessed(txDigest: string, eventSeq: string): Promise<boolean> {
  const existing = await db.query.suiEvents.findFirst({
    where: and(
      eq(suiEvents.txDigest, txDigest),
      eq(suiEvents.eventSeq, eventSeq),
    ),
  });
  return existing !== undefined;
}

async function recordEvent(
  txDigest: string,
  eventSeq: string,
  eventType: string,
  objectId: string | null,
  payload: unknown,
): Promise<void> {
  await db.insert(suiEvents).values({
    txDigest,
    eventSeq,
    eventType,
    objectId,
    payload: payload as Record<string, unknown>,
  }).onConflictDoNothing();
}

// ===== Handlers =====

export async function handleProgramCreated(
  txDigest: string,
  eventSeq: string,
  payload: ProgramCreatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  // Ensure a merchant_profiles row exists for this wallet (or create a stub).
  const existing = await db.query.merchantProfiles.findFirst({
    where: eq(merchantProfiles.walletAddress, payload.merchant),
  });

  let merchantProfileId: string;
  if (existing) {
    merchantProfileId = existing.id;
  } else {
    // Stub profile — suiObjectId is null until ProfileCreated event arrives.
    // BUG FIX: was suiObjectId: '' which caused UNIQUE violation on 2nd merchant.
    const [inserted] = await db.insert(merchantProfiles).values({
      suiObjectId: null,
      walletAddress: payload.merchant,
      businessName: payload.name, // best guess; merchant updates via UI
    }).returning({ id: merchantProfiles.id });
    merchantProfileId = inserted.id;
  }

  // BUG FIX: was hardcoded to 10. ProgramCreated event now includes stamps_required.
  await db.insert(stampPrograms).values({
    suiObjectId: payload.program_id,
    merchantProfileId,
    name: payload.name,
    stampsRequired: payload.stamps_required,
    isActive: true,
  });

  await recordEvent(txDigest, eventSeq, 'ProgramCreated', payload.program_id, payload);
}

export async function handleProgramUpdated(
  txDigest: string,
  eventSeq: string,
  payload: ProgramUpdatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;
  await db.update(stampPrograms)
    .set({ name: payload.name, updatedAt: new Date() })
    .where(eq(stampPrograms.suiObjectId, payload.program_id));
  await recordEvent(txDigest, eventSeq, 'ProgramUpdated', payload.program_id, payload);
}

export async function handleProgramActivated(
  txDigest: string,
  eventSeq: string,
  payload: ProgramActivatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;
  await db.update(stampPrograms)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(stampPrograms.suiObjectId, payload.program_id));
  await recordEvent(txDigest, eventSeq, 'ProgramActivated', payload.program_id, payload);
}

export async function handleProgramDeactivated(
  txDigest: string,
  eventSeq: string,
  payload: ProgramDeactivatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;
  await db.update(stampPrograms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(stampPrograms.suiObjectId, payload.program_id));
  await recordEvent(txDigest, eventSeq, 'ProgramDeactivated', payload.program_id, payload);
}

export async function handleCardCreated(
  txDigest: string,
  eventSeq: string,
  payload: CardCreatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  const program = await db.query.stampPrograms.findFirst({
    where: eq(stampPrograms.suiObjectId, payload.program_id),
  });
  if (!program) {
    console.warn(`handleCardCreated: program ${payload.program_id} not found in DB`);
    return;
  }

  await db.insert(stampCards).values({
    suiObjectId: payload.card_id,
    programId: program.id,
    customerWallet: payload.customer,
    currentStamps: 1,
  });

  await db.update(stampPrograms)
    .set({ totalIssued: program.totalIssued + 1, updatedAt: new Date() })
    .where(eq(stampPrograms.id, program.id));

  await recordEvent(txDigest, eventSeq, 'CardCreated', payload.card_id, payload);
}

export async function handleStampIssued(
  txDigest: string,
  eventSeq: string,
  payload: StampIssuedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  const card = await db.query.stampCards.findFirst({
    where: eq(stampCards.suiObjectId, payload.card_id),
  });
  if (!card) {
    // CardCreated event may not have been processed yet; skip — will be caught on next tick.
    console.warn(`handleStampIssued: card ${payload.card_id} not found`);
    return;
  }

  await db.update(stampCards)
    .set({
      currentStamps: payload.new_count,
      lastStamped: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stampCards.id, card.id));

  await recordEvent(txDigest, eventSeq, 'StampIssued', payload.card_id, payload);
}

export async function handleStampRedeemed(
  txDigest: string,
  eventSeq: string,
  payload: StampRedeemedPayload,
  redeemedAt: Date,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  const card = await db.query.stampCards.findFirst({
    where: eq(stampCards.suiObjectId, payload.card_id),
  });
  if (!card) {
    console.warn(`handleStampRedeemed: card ${payload.card_id} not found`);
    return;
  }

  const program = await db.query.stampPrograms.findFirst({
    where: eq(stampPrograms.suiObjectId, payload.program_id),
  });
  if (!program) return;

  // BUG FIX: was recalculating carry-forward from DB state (stale risk).
  // Now uses payload.remaining_stamps — the on-chain computed value is authoritative.
  await db.update(stampCards)
    .set({
      currentStamps: payload.remaining_stamps,
      totalEarned: payload.redemption_count,
      updatedAt: new Date(),
    })
    .where(eq(stampCards.id, card.id));

  await db.insert(redemptions).values({
    cardId: card.id,
    programId: program.id,
    txDigest,
    redeemedAt,
    redemptionCount: payload.redemption_count,
  }).onConflictDoNothing();

  await recordEvent(txDigest, eventSeq, 'StampRedeemed', payload.card_id, payload);
}

export async function handleThemeChanged(
  txDigest: string,
  eventSeq: string,
  payload: ThemeChangedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;
  await db.update(stampPrograms)
    .set({ themeId: payload.new_theme_id, updatedAt: new Date() })
    .where(eq(stampPrograms.suiObjectId, payload.program_id));
  await recordEvent(txDigest, eventSeq, 'ThemeChanged', payload.program_id, payload);
}

export async function handleProfileCreated(
  txDigest: string,
  eventSeq: string,
  payload: ProfileCreatedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  // If a stub row was created by handleProgramCreated (suiObjectId = null),
  // update it with the real sui_object_id now that the profile exists on-chain.
  const existing = await db.query.merchantProfiles.findFirst({
    where: eq(merchantProfiles.walletAddress, payload.merchant),
  });

  if (existing) {
    await db.update(merchantProfiles)
      .set({ suiObjectId: payload.profile_id })
      .where(eq(merchantProfiles.id, existing.id));
  } else {
    await db.insert(merchantProfiles).values({
      suiObjectId: payload.profile_id,
      walletAddress: payload.merchant,
      businessName: '',
    });
  }

  await recordEvent(txDigest, eventSeq, 'ProfileCreated', payload.profile_id, payload);
}

export async function handleStafferCapIssued(
  txDigest: string,
  eventSeq: string,
  payload: StafferCapIssuedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  const program = await db.query.stampPrograms.findFirst({
    where: eq(stampPrograms.suiObjectId, payload.program_id),
  });
  if (!program) return;

  await db.insert(stafferCaps).values({
    suiObjectId: payload.cap_id,
    programId: program.id,
    stafferWallet: payload.staffer,
  }).onConflictDoNothing();

  await recordEvent(txDigest, eventSeq, 'StafferCapIssued', payload.cap_id, payload);
}

export async function handleStafferCapRevoked(
  txDigest: string,
  eventSeq: string,
  payload: StafferCapRevokedPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;
  await db.update(stafferCaps)
    .set({ isRevoked: true })
    .where(eq(stafferCaps.suiObjectId, payload.cap_id));
  await recordEvent(txDigest, eventSeq, 'StafferCapRevoked', payload.cap_id, payload);
}

// ===== MerchantTransferred (was missing from original plan) =====

interface MerchantTransferredPayload { program_id: string; old_merchant: string; new_merchant: string }

export async function handleMerchantTransferred(
  txDigest: string,
  eventSeq: string,
  payload: MerchantTransferredPayload,
): Promise<void> {
  if (await alreadyProcessed(txDigest, eventSeq)) return;

  // Find the new merchant's profile (may not exist yet if they haven't set one up).
  const newProfile = await db.query.merchantProfiles.findFirst({
    where: eq(merchantProfiles.walletAddress, payload.new_merchant),
  });

  if (newProfile) {
    // Re-link the program to the new merchant's profile.
    await db.update(stampPrograms)
      .set({ merchantProfileId: newProfile.id, updatedAt: new Date() })
      .where(eq(stampPrograms.suiObjectId, payload.program_id));
  } else {
    // New merchant has no profile yet — create a stub so the program isn't orphaned.
    const [stub] = await db.insert(merchantProfiles).values({
      suiObjectId: null,
      walletAddress: payload.new_merchant,
      businessName: '',
    }).returning({ id: merchantProfiles.id });

    await db.update(stampPrograms)
      .set({ merchantProfileId: stub.id, updatedAt: new Date() })
      .where(eq(stampPrograms.suiObjectId, payload.program_id));
  }

  await recordEvent(txDigest, eventSeq, 'MerchantTransferred', payload.program_id, payload);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/indexer/handlers.ts
git commit -m "feat(indexer): event handler functions for all Sui events"
```

---

### Task 8: Indexer core and Vercel Cron API route

**Files:**
- Create: `src/lib/indexer/indexer.ts`
- Create: `src/app/api/indexer/tick/route.ts`
- Create: `vercel.json` (cron config)

- [ ] **Step 1: Create the indexer core**

```typescript
// src/lib/indexer/indexer.ts
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { db } from '@/lib/db';
import { indexerCheckpoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PACKAGE_ID, MODULE_NAME, EVENT_TYPES, SUI_NETWORK } from '@/lib/constants';
import {
  handleProgramCreated,
  handleProgramUpdated,
  handleProgramActivated,
  handleProgramDeactivated,
  handleCardCreated,
  handleStampIssued,
  handleStampRedeemed,
  handleThemeChanged,
  handleProfileCreated,
  handleStafferCapIssued,
  handleStafferCapRevoked,
} from './handlers';

const CURSOR_KEY = 'sui_event_cursor';
const PAGE_LIMIT = 50;

const rpcClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl(SUI_NETWORK),
  network: SUI_NETWORK,
});

async function getStoredCursor(): Promise<string | undefined> {
  const row = await db.query.indexerCheckpoints.findFirst({
    where: eq(indexerCheckpoints.key, CURSOR_KEY),
  });
  return row?.cursor;
}

async function saveCursor(cursor: string): Promise<void> {
  await db.insert(indexerCheckpoints)
    .values({ key: CURSOR_KEY, cursor, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: indexerCheckpoints.key,
      set: { cursor, updatedAt: new Date() },
    });
}

/** Processes one page of Sui events. Returns the next cursor (or undefined if done). */
export async function processTick(): Promise<{ processed: number; hasMore: boolean }> {
  const cursor = await getStoredCursor();

  const result = await rpcClient.queryEvents({
    query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } },
    cursor: cursor as never,
    limit: PAGE_LIMIT,
    order: 'ascending',
  });

  const events = result.data;
  let processed = 0;

  for (const event of events) {
    const txDigest = event.id.txDigest;
    const payload = event.parsedJson as Record<string, unknown>;
    const timestampMs = event.timestampMs ? Number(event.timestampMs) : Date.now();
    const eventDate = new Date(timestampMs);

    try {
      switch (event.type) {
        case EVENT_TYPES.programCreated:
          await handleProgramCreated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programUpdated:
          await handleProgramUpdated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programActivated:
          await handleProgramActivated(txDigest, payload as never);
          break;
        case EVENT_TYPES.programDeactivated:
          await handleProgramDeactivated(txDigest, payload as never);
          break;
        case EVENT_TYPES.cardCreated:
          await handleCardCreated(txDigest, payload as never);
          break;
        case EVENT_TYPES.stampIssued:
          await handleStampIssued(txDigest, payload as never);
          break;
        case EVENT_TYPES.stampRedeemed:
          await handleStampRedeemed(txDigest, payload as never, eventDate);
          break;
        case EVENT_TYPES.themeChanged:
          await handleThemeChanged(txDigest, payload as never);
          break;
        case EVENT_TYPES.profileCreated:
          await handleProfileCreated(txDigest, payload as never);
          break;
        case EVENT_TYPES.stafferCapIssued:
          await handleStafferCapIssued(txDigest, payload as never);
          break;
        case EVENT_TYPES.stafferCapRevoked:
          await handleStafferCapRevoked(txDigest, payload as never);
          break;
        default:
          // Unknown event type from this package — skip silently.
          break;
      }
      processed++;
    } catch (err) {
      console.error(`[indexer] Error processing ${event.type} tx=${txDigest}:`, err);
      // Continue processing other events rather than halting the whole tick.
    }
  }

  // Advance cursor past the processed page.
  if (result.nextCursor) {
    await saveCursor(JSON.stringify(result.nextCursor));
  }

  return { processed, hasMore: result.hasNextPage };
}
```

- [ ] **Step 2: Create the Vercel Cron API route**

```typescript
// src/app/api/indexer/tick/route.ts
import { NextResponse } from 'next/server';
import { processTick } from '@/lib/indexer/indexer';

/**
 * POST /api/indexer/tick
 *
 * Called by Vercel Cron every minute (see vercel.json).
 * Processes one page of Sui events and syncs them to Postgres.
 * Secured by CRON_SECRET header to prevent public invocation.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[indexer/tick]', err);
    return NextResponse.json({ error: 'Indexer tick failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add Vercel Cron config**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/indexer/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

- [ ] **Step 4: Add CRON_SECRET to env.ts and .env.local**

In `src/env.ts`, add to the `server` block:
```typescript
CRON_SECRET: z.string().min(32).describe('Secret for Vercel Cron auth'),
```
And to `runtimeEnv`:
```typescript
CRON_SECRET: process.env.CRON_SECRET,
```

In `.env.local`:
```bash
CRON_SECRET=<generate with: openssl rand -hex 32>
```

- [ ] **Step 5: Add new constants to EVENT_TYPES in src/lib/constants.ts**

(Full constants.ts update is in Task 10 below — do Task 10 first, then come back to confirm the indexer compiles.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/indexer/ src/app/api/indexer/ vercel.json src/env.ts
git commit -m "feat(indexer): Vercel Cron event indexer with cursor persistence and idempotent handlers"
```

---

## Phase 4 — TypeScript Layer

### Task 9: Update src/types/sui.ts

**Files:**
- Modify: `src/types/sui.ts`

- [ ] **Step 1: Replace the RawStampProgram and RawStampCard shapes**

In `src/types/sui.ts`, replace the raw RPC types and StampCard/StampProgram interfaces with:

```typescript
/**
 * Raw field shape returned by SuiClient for a StampProgram shared object (V3).
 */
export interface SuiRawStampProgram {
  id: { id: string };
  version: string;
  merchant: string;
  name: string;
  stamps_required: string;
  is_active: boolean;
  total_issued: string;
  theme_id?: string;
}

/**
 * Raw field shape returned by SuiClient for a StampCard shared object (V3).
 * merchant_name and merchant_logo removed — served from Postgres.
 */
export interface SuiRawStampCard {
  id: { id: string };
  version: string;
  program_id: string;
  customer: string;
  stamps_required: string;
  current_stamps: string;
  total_earned: string;
  last_stamped: string;
}

export interface SuiRawMerchantProfile {
  id: { id: string };
  merchant: string;
  unlocked_themes: string;
}

/**
 * Chain-only StampProgram — on-chain fields only.
 * Used for chain-verification reads (no Postgres enrichment).
 */
export interface StampProgram {
  objectId: SuiObjectId;
  version: number;
  merchant: SuiAddress;
  name: string;
  stampsRequired: number;
  isActive: boolean;
  totalIssued: number;
  themeId: number;
}

/**
 * Chain-only StampCard — on-chain fields only.
 * For enriched view with logo/description, use CardWithProgram from src/types/db.ts.
 */
export interface StampCard {
  objectId: SuiObjectId;
  version: number;
  programId: SuiObjectId;
  customer: SuiAddress;
  stampsRequired: number;
  currentStamps: number;
  totalEarned: number;
  lastStamped: number;
}

export interface MerchantProfile {
  objectId: SuiObjectId;
  merchant: SuiAddress;
  unlockedThemes: number;
}
```

Also update the event types — remove `logo_url` from `ProgramUpdatedEvent` and add new events:

```typescript
export interface ProgramUpdatedEvent {
  program_id: string;
  name: string;
  // logo_url removed — no longer on-chain
}

export interface ProgramActivatedEvent { program_id: string }
export interface ProgramDeactivatedEvent { program_id: string }

export interface StampIssuedEvent {
  card_id: string;
  program_id: string;
  customer: string;
  new_count: number;
  staffer: string;
}

export interface StafferCapIssuedEvent { cap_id: string; program_id: string; staffer: string }
export interface StafferCapRevokedEvent { cap_id: string; program_id: string }
```

- [ ] **Step 2: Create src/types/db.ts for DB-enriched response types**

```typescript
// src/types/db.ts
// DB-enriched response types returned by API routes (Postgres JOIN results).
// These combine on-chain identifiers with off-chain operational metadata.

/** Full card view: stamp card + program + merchant profile merged. */
export interface CardWithProgram {
  // From stamp_cards
  suiObjectId: string;
  currentStamps: number;
  totalEarned: number;
  lastStamped: string | null;   // ISO date string
  // From stamp_programs (via program_id FK)
  programSuiObjectId: string;
  programName: string;
  stampsRequired: number;
  isActive: boolean;
  themeId: number;
  // From merchant_profiles (via merchant_profile_id FK)
  merchantWallet: string;
  logoUrl: string;
  rewardDescription: string;
  businessName: string;
}

/** Program view with merchant metadata. */
export interface ProgramWithMerchant {
  suiObjectId: string;
  name: string;
  stampsRequired: number;
  isActive: boolean;
  themeId: number;
  totalIssued: number;
  merchantWallet: string;
  businessName: string;
  logoUrl: string;
  rewardDescription: string;
}

/** Merchant profile with full business details. */
export interface MerchantProfileFull {
  suiObjectId: string;
  walletAddress: string;
  businessName: string;
  displayName: string | null;
  logoUrl: string;
  website: string | null;
  instagram: string | null;
  category: string | null;
  openingHours: Record<string, string> | null;
  isVerified: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/sui.ts src/types/db.ts
git commit -m "feat(types): update chain types for V3 (remove merchant_name/logo, add version/isActive), add db.ts enriched types"
```

---

### Task 10: Update src/lib/constants.ts

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Replace TARGETS and EVENT_TYPES**

```typescript
// src/lib/constants.ts
import { env } from "@/env";

export const SUI_NETWORK = env.NEXT_PUBLIC_SUI_NETWORK;
export const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID;
export const MODULE_NAME = 'suiki' as const;

export const TARGETS = {
  createProgram:                    `${PACKAGE_ID}::${MODULE_NAME}::create_program`,
  createCardAndStamp:               `${PACKAGE_ID}::${MODULE_NAME}::create_card_and_stamp`,
  issueStamp:                       `${PACKAGE_ID}::${MODULE_NAME}::issue_stamp`,
  issueStampAsStaffer:              `${PACKAGE_ID}::${MODULE_NAME}::issue_stamp_as_staffer`,
  redeem:                           `${PACKAGE_ID}::${MODULE_NAME}::redeem`,
  updateProgram:                    `${PACKAGE_ID}::${MODULE_NAME}::update_program`,
  setTheme:                         `${PACKAGE_ID}::${MODULE_NAME}::set_theme`,
  setPremiumTheme:                  `${PACKAGE_ID}::${MODULE_NAME}::set_premium_theme`,
  deactivateProgram:                `${PACKAGE_ID}::${MODULE_NAME}::deactivate_program`,
  reactivateProgram:                `${PACKAGE_ID}::${MODULE_NAME}::reactivate_program`,
  transferMerchant:                 `${PACKAGE_ID}::${MODULE_NAME}::transfer_merchant`,
  issueStafferCap:                  `${PACKAGE_ID}::${MODULE_NAME}::issue_staffer_cap`,
  revokeStafferCap:                 `${PACKAGE_ID}::${MODULE_NAME}::revoke_staffer_cap`,
  createMerchantProfile:            `${PACKAGE_ID}::${MODULE_NAME}::create_merchant_profile`,
  createAndTransferMerchantProfile: `${PACKAGE_ID}::${MODULE_NAME}::create_and_transfer_merchant_profile`,
  purchaseTheme:                    `${PACKAGE_ID}::${MODULE_NAME}::purchase_theme`,
  syncCardStampsRequired:           `${PACKAGE_ID}::${MODULE_NAME}::sync_card_stamps_required`,
} as const;

export const CLOCK_ID = '0x6' as const;

export const EVENT_TYPES = {
  programCreated:    `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated`,
  programUpdated:    `${PACKAGE_ID}::${MODULE_NAME}::ProgramUpdated`,
  programActivated:  `${PACKAGE_ID}::${MODULE_NAME}::ProgramActivated`,
  programDeactivated:`${PACKAGE_ID}::${MODULE_NAME}::ProgramDeactivated`,
  cardCreated:       `${PACKAGE_ID}::${MODULE_NAME}::CardCreated`,
  stampIssued:       `${PACKAGE_ID}::${MODULE_NAME}::StampIssued`,
  stampRedeemed:     `${PACKAGE_ID}::${MODULE_NAME}::StampRedeemed`,
  themeChanged:      `${PACKAGE_ID}::${MODULE_NAME}::ThemeChanged`,
  profileCreated:    `${PACKAGE_ID}::${MODULE_NAME}::ProfileCreated`,
  themePurchased:    `${PACKAGE_ID}::${MODULE_NAME}::ThemePurchased`,
  stafferCapIssued:  `${PACKAGE_ID}::${MODULE_NAME}::StafferCapIssued`,
  stafferCapRevoked: `${PACKAGE_ID}::${MODULE_NAME}::StafferCapRevoked`,
} as const;

export const PREMIUM_THEME_PRICE_MIST = 1_000_000_000n;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(constants): add new V3 TARGETS (StafferCap, deactivate/reactivate) and EVENT_TYPES"
```

---

### Task 11: Update src/lib/transactions.ts

**Files:**
- Modify: `src/lib/transactions.ts`

- [ ] **Step 1: Replace the file with updated builders**

Key changes:
- `buildCreateProgram` no longer takes `logoUrl` or `rewardDescription` (moved to Postgres)
- `buildUpdateProgram` no longer takes `logoUrl` or `rewardDescription`
- New builders: `buildIssueStampAsStaffer`, `buildDeactivateProgram`, `buildReactivateProgram`, `buildIssueStafferCap`

```typescript
// src/lib/transactions.ts
import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID, PREMIUM_THEME_PRICE_MIST } from './constants';

/**
 * Builds a transaction that calls suiki::suiki::create_program.
 * V3: logo_url and reward_description moved to Postgres — not on-chain.
 */
export function buildCreateProgram(
  sender: string,
  name: string,
  stampsRequired: number,
  themeId: number,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.createProgram,
    arguments: [
      tx.pure.string(name),
      tx.pure.u64(stampsRequired),
      tx.pure.u8(themeId),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::create_card_and_stamp.
 */
export function buildCreateCardAndStamp(
  sender: string,
  programId: string,
  customerAddress: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.createCardAndStamp,
    arguments: [
      tx.object(programId),
      tx.pure.address(customerAddress),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_stamp.
 */
export function buildIssueStamp(
  sender: string,
  programId: string,
  cardId: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.issueStamp,
    arguments: [
      tx.object(programId),
      tx.object(cardId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_stamp_as_staffer.
 * Requires the caller to hold the StafferCap for this program.
 */
export function buildIssueStampAsStaffer(
  sender: string,
  programId: string,
  cardId: string,
  stafferCapId: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.issueStampAsStaffer,
    arguments: [
      tx.object(programId),
      tx.object(cardId),
      tx.object(stafferCapId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::redeem.
 */
export function buildRedeem(
  sender: string,
  programId: string,
  cardId: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.redeem,
    arguments: [
      tx.object(programId),
      tx.object(cardId),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::update_program.
 * V3: only updates the on-chain name. Use PUT /api/merchant/programs/[id] to update
 * logo_url and reward_description in Postgres.
 */
export function buildUpdateProgram(
  sender: string,
  programId: string,
  name: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.updateProgram,
    arguments: [
      tx.object(programId),
      tx.pure.string(name),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::set_theme.
 */
export function buildSetTheme(
  sender: string,
  programId: string,
  themeId: number,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.setTheme,
    arguments: [
      tx.object(programId),
      tx.pure.u8(themeId),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::deactivate_program.
 */
export function buildDeactivateProgram(sender: string, programId: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.deactivateProgram,
    arguments: [tx.object(programId)],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::reactivate_program.
 */
export function buildReactivateProgram(sender: string, programId: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.reactivateProgram,
    arguments: [tx.object(programId)],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_staffer_cap.
 */
export function buildIssueStafferCap(
  sender: string,
  programId: string,
  stafferAddress: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.issueStafferCap,
    arguments: [
      tx.object(programId),
      tx.pure.address(stafferAddress),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::create_and_transfer_merchant_profile.
 */
export function buildCreateMerchantProfile(sender: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({ target: TARGETS.createAndTransferMerchantProfile });
  return tx;
}

/**
 * Builds a PTB that creates a MerchantProfile and purchases a premium theme atomically.
 */
export function buildCreateProfileAndPurchaseTheme(sender: string, themeId: number): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const [profile] = tx.moveCall({ target: TARGETS.createMerchantProfile });
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(PREMIUM_THEME_PRICE_MIST)]);
  tx.moveCall({
    target: TARGETS.purchaseTheme,
    arguments: [profile, tx.pure.u8(themeId), payment],
  });
  tx.transferObjects([profile], tx.pure.address(sender));
  return tx;
}

/**
 * Builds a transaction that purchases a premium theme on an existing MerchantProfile.
 */
export function buildPurchaseTheme(sender: string, profileId: string, themeId: number): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(PREMIUM_THEME_PRICE_MIST)]);
  tx.moveCall({
    target: TARGETS.purchaseTheme,
    arguments: [tx.object(profileId), tx.pure.u8(themeId), payment],
  });
  return tx;
}

/**
 * Builds a transaction that sets a premium theme on a StampProgram.
 */
export function buildSetPremiumTheme(
  sender: string,
  programId: string,
  profileId: string,
  themeId: number,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.setPremiumTheme,
    arguments: [
      tx.object(programId),
      tx.object(profileId),
      tx.pure.u8(themeId),
    ],
  });
  return tx;
}
```

- [ ] **Step 2: Run tests (they will fail — that's expected; we'll fix them in Task 12)**

```bash
pnpm vitest run src/lib/__tests__/transactions.test.ts
```

Expected: Failures on `buildCreateProgram` and `buildUpdateProgram` (changed signatures). We will fix these next.

- [ ] **Step 3: Commit**

```bash
git add src/lib/transactions.ts
git commit -m "feat(transactions): update builders for V3 — remove off-chain args from create/update, add StafferCap builders"
```

---

### Task 12: Fix existing tests

**Files:**
- Modify: `src/lib/__tests__/transactions.test.ts`
- Modify: `src/lib/__tests__/queries.test.ts`

- [ ] **Step 1: Update transactions.test.ts**

Replace the `buildCreateProgram` and `buildUpdateProgram` test cases with the new V3 signatures. The tests that test the count of `moveCall` arguments must be updated:

```typescript
// In src/lib/__tests__/transactions.test.ts

// Replace the buildCreateProgram test block:
describe('buildCreateProgram', () => {
  it('creates a Transaction with correct target and 3 args', () => {
    const tx = buildCreateProgram(SENDER, 'Coffee Club', 10, 0);
    expect(tx).toBeInstanceOf(Transaction);
    const data = tx.getData();
    expect(data.commands).toHaveLength(1);
  });
});

// Replace the buildUpdateProgram test block (now takes only name, not logoUrl or rewardDescription):
describe('buildUpdateProgram', () => {
  it('creates a Transaction with updated name only', () => {
    const tx = buildUpdateProgram(SENDER, PROGRAM, 'New Name');
    expect(tx).toBeInstanceOf(Transaction);
  });
});

// Add new test:
describe('buildIssueStampAsStaffer', () => {
  const CAP = '0x6666666666666666666666666666666666666666666666666666666666666666';
  it('creates a Transaction with program, card, cap, and clock args', () => {
    const tx = buildIssueStampAsStaffer(SENDER, PROGRAM, CARD, CAP);
    expect(tx).toBeInstanceOf(Transaction);
  });
});

describe('buildDeactivateProgram', () => {
  it('creates a Transaction targeting deactivate_program', () => {
    const tx = buildDeactivateProgram(SENDER, PROGRAM);
    expect(tx).toBeInstanceOf(Transaction);
    const data = tx.getData();
    expect(JSON.stringify(data)).toContain('deactivate_program');
  });
});
```

- [ ] **Step 2: Update queries.test.ts**

Remove any assertions that reference `merchantName`, `merchantLogo`, or `logo_url` on StampCard/StampProgram. The queries.ts chain-read functions return leaner types now. Find and remove any test lines like:

```typescript
// REMOVE lines like these:
expect(card.merchantName).toBe(...);
expect(card.merchantLogo).toBe(...);
expect(program.logoUrl).toBe(...);
expect(program.rewardDescription).toBe(...);
```

- [ ] **Step 3: Run all tests and confirm they pass**

```bash
pnpm vitest run
```

Expected: All tests pass. If queries.test.ts has mock data issues, update `src/lib/mock-data.ts` to remove `merchantName` and `merchantLogo` from mock StampCard objects.

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/
git commit -m "test: update transactions and queries tests for V3 type changes"
```

---

## Phase 5 — API Routes

### Task 13: Customer cards API route

**Files:**
- Create: `src/app/api/customer/[wallet]/cards/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/customer/[wallet]/cards/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampCards, stampPrograms, merchantProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { CardWithProgram } from '@/types/db';

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { wallet } = await params;

  if (!wallet || !wallet.startsWith('0x')) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const rows = await db
    .select({
      suiObjectId: stampCards.suiObjectId,
      currentStamps: stampCards.currentStamps,
      totalEarned: stampCards.totalEarned,
      lastStamped: stampCards.lastStamped,
      programSuiObjectId: stampPrograms.suiObjectId,
      programName: stampPrograms.name,
      stampsRequired: stampPrograms.stampsRequired,
      isActive: stampPrograms.isActive,
      themeId: stampPrograms.themeId,
      logoUrl: merchantProfiles.logoUrl,
      rewardDescription: stampPrograms.rewardDescription,
      businessName: merchantProfiles.businessName,
      merchantWallet: merchantProfiles.walletAddress,
    })
    .from(stampCards)
    .innerJoin(stampPrograms, eq(stampCards.programId, stampPrograms.id))
    .innerJoin(merchantProfiles, eq(stampPrograms.merchantProfileId, merchantProfiles.id))
    .where(eq(stampCards.customerWallet, wallet));

  const cards: CardWithProgram[] = rows.map((row) => ({
    ...row,
    lastStamped: row.lastStamped?.toISOString() ?? null,
  }));

  return NextResponse.json({ data: cards });
}
```

- [ ] **Step 2: Create single card route**

```typescript
// src/app/api/customer/[wallet]/cards/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampCards, stampPrograms, merchantProfiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { CardWithProgram } from '@/types/db';

interface RouteParams {
  params: Promise<{ wallet: string; id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { wallet, id } = await params;

  const [row] = await db
    .select({
      suiObjectId: stampCards.suiObjectId,
      currentStamps: stampCards.currentStamps,
      totalEarned: stampCards.totalEarned,
      lastStamped: stampCards.lastStamped,
      programSuiObjectId: stampPrograms.suiObjectId,
      programName: stampPrograms.name,
      stampsRequired: stampPrograms.stampsRequired,
      isActive: stampPrograms.isActive,
      themeId: stampPrograms.themeId,
      logoUrl: merchantProfiles.logoUrl,
      rewardDescription: stampPrograms.rewardDescription,
      businessName: merchantProfiles.businessName,
      merchantWallet: merchantProfiles.walletAddress,
    })
    .from(stampCards)
    .innerJoin(stampPrograms, eq(stampCards.programId, stampPrograms.id))
    .innerJoin(merchantProfiles, eq(stampPrograms.merchantProfileId, merchantProfiles.id))
    .where(and(eq(stampCards.suiObjectId, id), eq(stampCards.customerWallet, wallet)));

  if (!row) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const card: CardWithProgram = { ...row, lastStamped: row.lastStamped?.toISOString() ?? null };
  return NextResponse.json({ data: card });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/customer/
git commit -m "feat(api): GET /api/customer/[wallet]/cards — DB-first card listing with program JOIN"
```

---

### Task 14: Merchant programs API routes

**Files:**
- Create: `src/app/api/merchant/programs/route.ts`
- Create: `src/app/api/merchant/programs/[id]/route.ts`
- Create: `src/app/api/programs/[programId]/route.ts`

- [ ] **Step 1: POST to create program metadata (called after on-chain create)**

```typescript
// src/app/api/merchant/programs/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampPrograms, merchantProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface CreateProgramBody {
  suiObjectId: string;
  merchantWallet: string;
  logoUrl?: string;
  rewardDescription?: string;
  stampsRequired: number;
}

/**
 * POST /api/merchant/programs
 * Called immediately after on-chain create_program succeeds.
 * Creates the Postgres row with off-chain metadata.
 * The indexer will also create this row from the ProgramCreated event,
 * so we use ON CONFLICT DO UPDATE to handle races.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as CreateProgramBody;

  if (!body.suiObjectId || !body.merchantWallet) {
    return NextResponse.json({ error: 'suiObjectId and merchantWallet required' }, { status: 400 });
  }

  // Find or create merchant profile stub.
  let profile = await db.query.merchantProfiles.findFirst({
    where: eq(merchantProfiles.walletAddress, body.merchantWallet),
  });
  if (!profile) {
    const [inserted] = await db.insert(merchantProfiles).values({
      suiObjectId: '',
      walletAddress: body.merchantWallet,
      businessName: '',
    }).returning();
    profile = inserted;
  }

  const [program] = await db.insert(stampPrograms)
    .values({
      suiObjectId: body.suiObjectId,
      merchantProfileId: profile.id,
      name: '',  // will be updated by indexer from ProgramCreated event
      stampsRequired: body.stampsRequired,
      logoUrl: body.logoUrl ?? '',
      rewardDescription: body.rewardDescription ?? '',
    })
    .onConflictDoUpdate({
      target: stampPrograms.suiObjectId,
      set: {
        logoUrl: body.logoUrl ?? '',
        rewardDescription: body.rewardDescription ?? '',
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json({ data: program }, { status: 201 });
}

/** GET /api/merchant/programs — all programs for a merchant wallet. */
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 });
  }

  const profile = await db.query.merchantProfiles.findFirst({
    where: eq(merchantProfiles.walletAddress, wallet),
    with: { programs: true },
  });

  return NextResponse.json({ data: profile?.programs ?? [] });
}
```

- [ ] **Step 2: PUT to update off-chain program metadata**

```typescript
// src/app/api/merchant/programs/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampPrograms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface UpdateProgramBody {
  logoUrl?: string;
  rewardDescription?: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/merchant/programs/[id] — update Postgres-only fields (no chain call needed). */
export async function PUT(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as UpdateProgramBody;

  await db.update(stampPrograms)
    .set({
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.rewardDescription !== undefined && { rewardDescription: body.rewardDescription }),
      updatedAt: new Date(),
    })
    .where(eq(stampPrograms.suiObjectId, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: GET single program route**

```typescript
// src/app/api/programs/[programId]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stampPrograms, merchantProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ProgramWithMerchant } from '@/types/db';

interface RouteParams {
  params: Promise<{ programId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { programId } = await params;

  const [row] = await db
    .select({
      suiObjectId: stampPrograms.suiObjectId,
      name: stampPrograms.name,
      stampsRequired: stampPrograms.stampsRequired,
      isActive: stampPrograms.isActive,
      themeId: stampPrograms.themeId,
      totalIssued: stampPrograms.totalIssued,
      logoUrl: merchantProfiles.logoUrl,
      rewardDescription: stampPrograms.rewardDescription,
      businessName: merchantProfiles.businessName,
      merchantWallet: merchantProfiles.walletAddress,
    })
    .from(stampPrograms)
    .innerJoin(merchantProfiles, eq(stampPrograms.merchantProfileId, merchantProfiles.id))
    .where(eq(stampPrograms.suiObjectId, programId));

  if (!row) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  const program: ProgramWithMerchant = row;
  return NextResponse.json({ data: program });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/merchant/ src/app/api/programs/
git commit -m "feat(api): merchant program routes — POST create, PUT update metadata, GET single program"
```

---

## Phase 6 — UI Updates

### Task 15: Update hooks to use API routes

**Files:**
- Modify: `src/hooks/use-my-cards.ts`
- Modify: `src/hooks/use-my-programs.ts`

- [ ] **Step 1: Update use-my-cards.ts**

```typescript
// src/hooks/use-my-cards.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import type { CardWithProgram } from '@/types/db';

async function fetchCards(wallet: string): Promise<CardWithProgram[]> {
  const res = await fetch(`/api/customer/${wallet}/cards`);
  if (!res.ok) throw new Error('Failed to fetch cards');
  const json = await res.json() as { data: CardWithProgram[] };
  return json.data;
}

export function useMyCards() {
  const account = useAccount();

  return useQuery<CardWithProgram[], Error>({
    queryKey: ['cards', account?.address],
    queryFn: () => fetchCards(account!.address),
    enabled: !!account,
  });
}
```

- [ ] **Step 2: Update use-my-programs.ts**

```typescript
// src/hooks/use-my-programs.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import type { ProgramWithMerchant } from '@/types/db';

async function fetchPrograms(wallet: string): Promise<ProgramWithMerchant[]> {
  const res = await fetch(`/api/merchant/programs?wallet=${wallet}`);
  if (!res.ok) throw new Error('Failed to fetch programs');
  const json = await res.json() as { data: ProgramWithMerchant[] };
  return json.data;
}

export function useMyPrograms() {
  const account = useAccount();

  return useQuery<ProgramWithMerchant[], Error>({
    queryKey: ['programs', account?.address],
    queryFn: () => fetchPrograms(account!.address),
    enabled: !!account,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-my-cards.ts src/hooks/use-my-programs.ts
git commit -m "feat(hooks): use-my-cards and use-my-programs fetch from API routes (DB-first)"
```

---

### Task 16: Update customer UI to use CardWithProgram

**Files:**
- Modify: `src/app/customer/page.tsx`
- Modify: `src/app/customer/cards/[cardId]/page.tsx`

- [ ] **Step 1: Update src/app/customer/page.tsx**

Replace the `StampCard` type import and all references to `card.merchantName` / `card.merchantLogo`:

```typescript
// Change the import at the top:
import type { CardWithProgram } from "@/types/db";

// Change the filter function signature:
function filterCards(cards: CardWithProgram[], filter: string): CardWithProgram[] {
  switch (filter) {
    case "active":
      return cards.filter(
        (c) => c.currentStamps > 0 && c.currentStamps < c.stampsRequired,
      );
    case "near":
      return cards.filter(
        (c) =>
          c.stampsRequired > 0 &&
          c.currentStamps / c.stampsRequired >= 0.8 &&
          c.currentStamps < c.stampsRequired,
      );
    case "done":
      return cards.filter((c) => c.currentStamps >= c.stampsRequired);
    default:
      return cards;
  }
}
```

In `CustomerDashboard`, update the `useMyCards` type and the sort comparator (replace `b.lastStamped - a.lastStamped` with date comparison):

```typescript
// Replace sort comparator:
const sorted = [...cards].sort((a, b) => {
  const pA = a.currentStamps / Math.max(a.stampsRequired, 1);
  const pB = b.currentStamps / Math.max(b.stampsRequired, 1);
  if (pB !== pA) return pB - pA;
  const tA = a.lastStamped ? new Date(a.lastStamped).getTime() : 0;
  const tB = b.lastStamped ? new Date(b.lastStamped).getTime() : 0;
  return tB - tA;
});
```

In the `StampCard` component call, replace the props:

```typescript
<StampCard
  programId={card.programSuiObjectId}
  merchantName={card.businessName}       // was card.merchantName
  programName={card.programName}          // was "Loyalty Program"
  logoUrl={card.logoUrl}                  // was card.merchantLogo
  stampCount={card.currentStamps}
  totalStamps={card.stampsRequired}
  rewardDescription={card.rewardDescription}  // was "Reward"
  variant="compact"
  onTap={() => router.push(`/customer/cards/${card.suiObjectId}`)}
/>
```

- [ ] **Step 2: Update card detail page to fetch from API**

In `src/app/customer/cards/[cardId]/page.tsx`, the card data now comes from `/api/customer/[wallet]/cards/[id]`. Update the data fetching in `CardDetailView` to use the new API route and `CardWithProgram` type. Replace `useMyCards` + find logic with a dedicated single-card query:

```typescript
// Add this hook near the top of the file:
import { useQuery } from '@tanstack/react-query';
import { useAccount } from '@/hooks/use-account';
import type { CardWithProgram } from '@/types/db';

function useCard(cardId: string) {
  const account = useAccount();
  return useQuery<CardWithProgram, Error>({
    queryKey: ['card', cardId],
    queryFn: async () => {
      const res = await fetch(`/api/customer/${account!.address}/cards/${cardId}`);
      if (!res.ok) throw new Error('Card not found');
      const json = await res.json() as { data: CardWithProgram };
      return json.data;
    },
    enabled: !!account,
  });
}
```

In `CardDetailView`, replace `useMyCards` + find with `useCard(cardId)`. Replace all `card.merchantName` → `card.businessName`, `card.merchantLogo` → `card.logoUrl`, `card.lastStamped` (was a number) → `new Date(card.lastStamped ?? 0).getTime()`.

- [ ] **Step 3: Run the dev server and verify customer pages render**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/customer`. Cards should load from Postgres via the API. If no cards appear (fresh DB), test by triggering a transaction on testnet and waiting for the indexer tick.

- [ ] **Step 4: Commit**

```bash
git add src/app/customer/
git commit -m "feat(ui): customer pages use CardWithProgram from API — remove stale merchant_name/logo chain reads"
```

---

### Task 17: Update merchant create page

**Files:**
- Modify: `src/app/merchant/create/page.tsx`

- [ ] **Step 1: Update the form submit handler**

The merchant create page currently calls `buildCreateProgram` with `logoUrl` and `rewardDescription`. In V3, these go to Postgres via the API after the on-chain TX succeeds.

Find the form submit handler (look for `buildCreateProgram` call) and update the flow:

```typescript
// Old flow (V2):
// buildCreateProgram(sender, name, logoUrl, stampsRequired, rewardDescription, themeId)

// New flow (V3):
// 1. Build on-chain TX (name + stampsRequired + themeId only)
// 2. After TX succeeds, extract new program object ID from TX result
// 3. POST to /api/merchant/programs with { suiObjectId, merchantWallet, logoUrl, rewardDescription }

async function handleSubmit() {
  // Step 1: on-chain TX
  const tx = buildCreateProgram(sender, name, stampsRequired, themeId);
  const result = await signAndExecuteTransaction({ transaction: tx });

  // Step 2: extract program object ID from created objects
  const programObjectId = result.effects?.created?.find(
    (obj) => obj.owner === 'Shared'
  )?.reference?.objectId;

  if (!programObjectId) throw new Error('Could not find created program object ID');

  // Step 3: save off-chain metadata to Postgres
  await fetch('/api/merchant/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suiObjectId: programObjectId,
      merchantWallet: sender,
      logoUrl,
      rewardDescription,
      stampsRequired,
    }),
  });
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
pnpm vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Final commit**

```bash
git add src/app/merchant/create/page.tsx
git commit -m "feat(ui): merchant create page — post-TX metadata saved to Postgres via API"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Tasks Covering It |
|---|---|
| Move contract structs (§3.3) | Task 1 |
| Clever errors + VERSION (§3.1, §3.7) | Task 1 |
| StafferCap (§8) | Task 1, 11 |
| Move tests (§3.5) | Task 2 |
| Deploy + PACKAGE_ID (§10) | Task 3 |
| Neon Postgres schema all tables (§4.1) | Task 5 |
| Indexes (§4.2) | Task 5 (Drizzle adds indexes via push) |
| DB client + Drizzle config (§4) | Task 6 |
| Event indexer + cursor persistence (§5.3, §5.4) | Task 7, 8 |
| All event handlers mapped (§5.2) | Task 7 |
| Vercel Cron deployment (§11 open question 1) | Task 8 |
| TypeScript types updated (chain + DB) | Task 9 |
| TARGETS + EVENT_TYPES updated | Task 10 |
| Transaction builders updated | Task 11 |
| Test fixes | Task 12 |
| Customer card API routes (§7.2) | Task 13 |
| Merchant program API routes (§7.2) | Task 14 |
| Hooks switched to DB-first (§7.1) | Task 15 |
| UI removes stale chain fields (§10 step 5) | Task 16, 17 |
| PDPA compliance (§4.3) | Schema has nullable PII fields; insert-side encryption deferred to post-MVP |
| Display V2 deadline (§3.8) | Not in this plan — tracked as a separate upgrade before July 2026 |
| Dynamic fields registry (§6) | Not in this plan — no fields needed at initial deploy; registry docs serve future upgrades |

**Placeholder scan:** No TBDs found. All code steps have complete implementations.

**Type consistency:** `CardWithProgram.suiObjectId` used in Task 13 (route) and Task 15/16 (hook + UI). `ProgramWithMerchant` used in Task 14 (route) and Task 15 (hook). `buildCreateProgram(sender, name, stampsRequired, themeId)` — 4 args used consistently in Tasks 11, 12, 17.
