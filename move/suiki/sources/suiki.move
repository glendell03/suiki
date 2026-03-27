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
