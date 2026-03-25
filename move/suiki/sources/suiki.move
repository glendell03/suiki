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
    const EInvalidStampsRequired: u64 = 4;
    const EInvalidUrl: u64 = 5;

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
        total_issued: u64,  // tracks cards created (create_card_and_stamp only)
    }

    /// Shared object representing a customer's stamp card for a specific program.
    /// Acts as an upgradeable NFT via SUI Display standard.
    public struct StampCard has key {
        id: UID,
        program_id: ID,
        customer: address,
        merchant_name: String,   // snapshot at card creation; call sync_card_metadata to refresh
        merchant_logo: String,   // snapshot at card creation; call sync_card_metadata to refresh
        stamps_required: u64,
        current_stamps: u64,
        total_earned: u64,       // number of completed redemption cycles (not stamp count)
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
        redemption_count: u64,   // total completed redemption cycles
    }

    public struct ProgramUpdated has copy, drop {
        program_id: ID,
        name: String,
        logo_url: String,
    }

    public struct MerchantTransferred has copy, drop {
        program_id: ID,
        old_merchant: address,
        new_merchant: address,
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
    /// stamps_required must be >= 1. logo_url must be non-empty and <= 2048 chars.
    public fun create_program(
        name: String,
        logo_url: String,
        stamps_required: u64,
        reward_description: String,
        ctx: &mut TxContext,
    ) {
        assert!(stamps_required > 0, EInvalidStampsRequired);
        assert!(logo_url.length() > 0 && logo_url.length() <= 2048, EInvalidUrl);

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
    /// Takes &StampProgram (immutable) to reduce shared-object contention under high load.
    /// total_issued tracking is via off-chain StampIssued event indexing.
    public fun issue_stamp(
        program: &StampProgram,
        card: &mut StampCard,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(card.program_id == object::id(program), EProgramMismatch);

        card.current_stamps = card.current_stamps + 1;
        card.last_stamped = clock.timestamp_ms();

        event::emit(StampIssued {
            card_id: object::id(card),
            program_id: card.program_id,
            customer: card.customer,
            new_count: card.current_stamps,
        });
    }

    /// Customer redeems stamps when they reach the required count.
    /// Excess stamps beyond stamps_required are carried forward (not lost).
    /// total_earned counts completed redemption cycles.
    public fun redeem(
        program: &StampProgram,
        card: &mut StampCard,
        ctx: &TxContext,
    ) {
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
        });
    }

    /// Merchant updates their program details (name, logo, reward).
    /// Note: existing StampCards cache merchant_name/merchant_logo at creation time.
    /// Call sync_card_metadata on each card to push updated branding.
    public fun update_program(
        program: &mut StampProgram,
        name: String,
        logo_url: String,
        reward_description: String,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(logo_url.length() > 0 && logo_url.length() <= 2048, EInvalidUrl);
        program.name = name;
        program.logo_url = logo_url;
        program.reward_description = reward_description;

        event::emit(ProgramUpdated {
            program_id: object::id(program),
            name,
            logo_url,
        });
    }

    /// Merchant pushes updated name/logo branding to an existing customer card.
    /// Call this after update_program to refresh the Display NFT metadata.
    public fun sync_card_metadata(
        program: &StampProgram,
        card: &mut StampCard,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        assert!(card.program_id == object::id(program), EProgramMismatch);
        card.merchant_name = program.name;
        card.merchant_logo = program.logo_url;
        card.stamps_required = program.stamps_required;
    }

    /// Merchant transfers program ownership to a new wallet address.
    /// Use for wallet migration or business ownership transfer.
    public fun transfer_merchant(
        program: &mut StampProgram,
        new_merchant: address,
        ctx: &TxContext,
    ) {
        assert!(program.merchant == ctx.sender(), ENotMerchant);
        let old_merchant = program.merchant;
        program.merchant = new_merchant;

        event::emit(MerchantTransferred {
            program_id: object::id(program),
            old_merchant,
            new_merchant,
        });
    }

    // ===== Accessor functions =====

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
    public fun card_merchant_name(c: &StampCard): String { c.merchant_name }
    public fun card_merchant_logo(c: &StampCard): String { c.merchant_logo }
    /// Alias for card_total_earned — counts completed redemption cycles.
    public fun card_redemption_count(c: &StampCard): u64 { c.total_earned }
}
