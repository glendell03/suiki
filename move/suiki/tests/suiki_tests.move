#[test_only]
module suiki::suiki_tests {
    use sui::test_scenario;
    use sui::clock;
    use std::string;
    use suiki::suiki::{Self, StampProgram, StampCard};

    // ===== Test addresses =====

    const MERCHANT: address = @0xCAFE;
    const CUSTOMER: address = @0xBEEF;
    const OTHER: address = @0xDEAD;
    const NEW_MERCHANT: address = @0xF00D;

    // ===== Happy-path tests =====

    #[test]
    /// Merchant can create a program; all fields are initialised correctly
    /// including the fields not covered by the basic create_card tests.
    fun test_create_program() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            10,
            string::utf8(b"Free brewed coffee"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            assert!(suiki::program_merchant(&program) == MERCHANT);
            assert!(suiki::program_stamps_required(&program) == 10);
            assert!(suiki::program_total_issued(&program) == 0);
            assert!(suiki::program_name(&program) == string::utf8(b"Kape ni Juan"));
            assert!(suiki::program_logo_url(&program) == string::utf8(b"https://example.com/logo.png"));
            assert!(suiki::program_reward_description(&program) == string::utf8(b"Free brewed coffee"));
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EInvalidStampsRequired)]
    /// create_program aborts when stamps_required is zero.
    fun test_create_program_zero_stamps_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Bad Program"),
            string::utf8(b"https://example.com/logo.png"),
            0,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EInvalidUrl)]
    /// create_program aborts when logo_url is empty.
    fun test_create_program_empty_url_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Bad Program"),
            string::utf8(b""),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.end();
    }

    #[test]
    /// Merchant creates a card for a customer; first stamp is counted and
    /// program total_issued increments to 1.
    fun test_create_card_and_stamp() {
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
            assert!(suiki::program_total_issued(&program) == 1);
            test_scenario::return_shared(program);
        };

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
    /// Merchant issues a second stamp via issue_stamp; current_stamps increments
    /// but program_total_issued does NOT increment (only create_card_and_stamp
    /// tracks total_issued).
    fun test_issue_stamp() {
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
            // total_issued is 1 after create_card_and_stamp
            assert!(suiki::program_total_issued(&program) == 1);
            test_scenario::return_shared(program);
        };

        scenario.next_tx(MERCHANT);
        {
            // issue_stamp takes &StampProgram (immutable) in the fixed contract.
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            // program_total_issued must NOT change — issue_stamp does not increment it.
            assert!(suiki::program_total_issued(&program) == 1);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// Customer redeems a full card (3 stamps, stamps_required = 3).
    /// After redemption: current_stamps = 0 (no excess), total_earned = 1 (one cycle).
    fun test_redeem() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let mut test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            3,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Issue 2 more stamps (total = 3, exactly stamps_required).
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            clock::set_for_testing(&mut test_clock, 1000);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            clock::set_for_testing(&mut test_clock, 2000);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 3);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // Customer redeems — exactly one full cycle.
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            // No excess stamps remain.
            assert!(suiki::card_current_stamps(&card) == 0);
            // total_earned counts cycles completed, not stamps consumed.
            assert!(suiki::card_total_earned(&card) == 1);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// Customer redeems when card has more stamps than required.
    /// With 5 stamps and stamps_required = 3: excess = 5 - 3 = 2.
    /// After redemption: current_stamps = 2 (carried forward), total_earned = 1 (one cycle).
    fun test_redeem_carry_forward() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            3,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Stamp 1 via create_card_and_stamp.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // Issue 4 more stamps so card has 5 total (exceeds stamps_required = 3).
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 5);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // Customer redeems — excess 2 stamps carry forward.
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            // 5 - 3 = 2 excess stamps carried forward.
            assert!(suiki::card_current_stamps(&card) == 2);
            // One cycle completed.
            assert!(suiki::card_total_earned(&card) == 1);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// Two full redemption cycles: total_earned = 2 after the second redeem.
    fun test_multiple_redemptions() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // stamps_required = 2 keeps each cycle short.
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            2,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // First cycle: stamp 1 via create_card_and_stamp, then issue stamp 2.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // First redemption — one cycle complete.
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 0);
            assert!(suiki::card_total_earned(&card) == 1);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // Second cycle: issue 2 more stamps.
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        // Second redemption — two cycles complete, total_earned = 2.
        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 0);
            assert!(suiki::card_total_earned(&card) == 2);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// Merchant can update name, logo_url, and reward_description;
    /// all fields reflect new values immediately.
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
            assert!(suiki::program_reward_description(&program) == string::utf8(b"New reward"));
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    /// After update_program, sync_card_metadata copies the updated name and
    /// logo from the program onto the customer's card.
    fun test_sync_card_metadata() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Original Name"),
            string::utf8(b"https://old.com/logo.png"),
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

        // Merchant updates program details.
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
            test_scenario::return_shared(program);
        };

        // Merchant syncs card metadata so the card reflects the updated program.
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::sync_card_metadata(&program, &mut card, scenario.ctx());
            assert!(suiki::card_merchant_name(&card) == string::utf8(b"New Name"));
            assert!(suiki::card_merchant_logo(&card) == string::utf8(b"https://new.com/logo.png"));
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// Merchant transfers ownership to a new merchant.
    /// New merchant can issue stamps; old merchant cannot.
    fun test_transfer_merchant() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Create a card so we have something to stamp in later steps.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // MERCHANT transfers the program to NEW_MERCHANT.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::transfer_merchant(&mut program, NEW_MERCHANT, scenario.ctx());
            assert!(suiki::program_merchant(&program) == NEW_MERCHANT);
            test_scenario::return_shared(program);
        };

        // NEW_MERCHANT can now issue a stamp.
        scenario.next_tx(NEW_MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    /// After transfer_merchant, the old merchant can no longer issue stamps.
    fun test_old_merchant_cannot_stamp_after_transfer() {
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

        // MERCHANT transfers ownership to NEW_MERCHANT.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::transfer_merchant(&mut program, NEW_MERCHANT, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // MERCHANT (old owner) attempts to issue a stamp — must abort with ENotMerchant.
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// last_stamped on the card is set to the clock timestamp at the time
    /// of each stamp call and updates correctly on subsequent stamps.
    fun test_last_stamped_tracks_clock() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let mut test_clock = clock::create_for_testing(scenario.ctx());
        clock::set_for_testing(&mut test_clock, 5000);

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Create card — first stamp should record timestamp 5000.
        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        scenario.next_tx(MERCHANT);
        {
            let card = test_scenario::take_shared<StampCard>(&scenario);
            assert!(suiki::card_last_stamped(&card) == 5000);
            test_scenario::return_shared(card);
        };

        // Advance clock and issue another stamp; last_stamped must update.
        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            clock::set_for_testing(&mut test_clock, 9999);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            assert!(suiki::card_last_stamped(&card) == 9999);
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    /// card_program_id on the StampCard matches the ID of the program that
    /// issued it.
    fun test_card_program_id_matches_program() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // Capture program ID before creating the card so we can compare later.
        scenario.next_tx(MERCHANT);
        let program_id = {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let id = sui::object::id(&program);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
            id
        };

        scenario.next_tx(CUSTOMER);
        {
            let card = test_scenario::take_shared<StampCard>(&scenario);
            assert!(suiki::card_program_id(&card) == program_id);
            test_scenario::return_shared(card);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    // ===== Failure tests =====

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    /// A non-merchant address cannot issue a stamp.
    fun test_issue_stamp_not_merchant_fails() {
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

        // OTHER tries to issue stamp — must abort with ENotMerchant.
        scenario.next_tx(OTHER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    /// A non-merchant address cannot create a card for a customer.
    fun test_create_card_not_merchant_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // OTHER tries to create a card on MERCHANT's program — must abort.
        scenario.next_tx(OTHER);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotMerchant)]
    /// A non-merchant address cannot update a program.
    fun test_update_program_not_merchant_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Original Name"),
            string::utf8(b"https://example.com/logo.png"),
            5,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        // OTHER tries to update the program — must abort with ENotMerchant.
        scenario.next_tx(OTHER);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::update_program(
                &mut program,
                string::utf8(b"Hijacked Name"),
                string::utf8(b"https://evil.com/logo.png"),
                string::utf8(b"No reward"),
                scenario.ctx(),
            );
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::ENotEnoughStamps)]
    /// Customer cannot redeem with fewer stamps than required.
    fun test_redeem_not_enough_stamps_fails() {
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

        // Customer tries to redeem with only 1 stamp — must abort with ENotEnoughStamps.
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
    #[expected_failure(abort_code = suiki::suiki::ENotCustomer)]
    /// A third party cannot redeem another customer's card.
    fun test_redeem_not_customer_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // stamps_required = 1 so the card is immediately redeemable.
        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            string::utf8(b"https://example.com/logo.png"),
            1,
            string::utf8(b"Free coffee"),
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program);
        };

        // OTHER tries to redeem CUSTOMER's card — must abort with ENotCustomer.
        scenario.next_tx(OTHER);
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
    #[expected_failure(abort_code = suiki::suiki::EProgramMismatch)]
    /// issue_stamp aborts when the card belongs to a different program than
    /// the one passed in.
    ///
    /// Strategy: create program A then program B.  take_shared returns the
    /// most-recently-created untaken object, so the first take_shared call
    /// inside each tx block gets program B and the second gets program A.
    /// We create the customer card via program A, then try to stamp it via
    /// program B — triggering EProgramMismatch.
    fun test_issue_stamp_program_mismatch_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // Create program A (older, lower ID).
        suiki::create_program(
            string::utf8(b"Program A"),
            string::utf8(b"https://a.com/logo.png"),
            5,
            string::utf8(b"Reward A"),
            scenario.ctx(),
        );

        // Create program B (newer, higher ID) in the same tx so both are
        // visible after next_tx.
        suiki::create_program(
            string::utf8(b"Program B"),
            string::utf8(b"https://b.com/logo.png"),
            5,
            string::utf8(b"Reward B"),
            scenario.ctx(),
        );

        // Capture the ID of program B (most recently created) and use program A
        // to create the customer card, so card.program_id == A.
        scenario.next_tx(MERCHANT);
        let program_b_id = {
            // First take_shared returns the most recently created: program B.
            let program_b = test_scenario::take_shared<StampProgram>(&scenario);
            let id = sui::object::id(&program_b);
            test_scenario::return_shared(program_b);

            // Second take_shared returns program A.
            let mut program_a = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program_a, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program_a);
            id
        };

        // Try to stamp the card (linked to program A) using program B — must
        // abort with EProgramMismatch.
        scenario.next_tx(MERCHANT);
        {
            let program_b = test_scenario::take_shared_by_id<StampProgram>(&scenario, program_b_id);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::issue_stamp(&program_b, &mut card, &test_clock, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program_b);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }

    #[test]
    #[expected_failure(abort_code = suiki::suiki::EProgramMismatch)]
    /// redeem aborts when the card's program_id does not match the program
    /// passed in.
    ///
    /// Same two-program strategy as test_issue_stamp_program_mismatch_fails.
    /// Card is stamped via program A (stamps_required = 1, so immediately
    /// redeemable), then the customer passes program B to redeem — triggering
    /// EProgramMismatch before ENotEnoughStamps is checked.
    fun test_redeem_program_mismatch_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        let test_clock = clock::create_for_testing(scenario.ctx());

        // stamps_required = 1 so the card qualifies for redemption;
        // the mismatch error must fire before the stamp-count check.
        suiki::create_program(
            string::utf8(b"Program A"),
            string::utf8(b"https://a.com/logo.png"),
            1,
            string::utf8(b"Reward A"),
            scenario.ctx(),
        );

        suiki::create_program(
            string::utf8(b"Program B"),
            string::utf8(b"https://b.com/logo.png"),
            1,
            string::utf8(b"Reward B"),
            scenario.ctx(),
        );

        // Create card via program A; capture program B's ID.
        scenario.next_tx(MERCHANT);
        let program_b_id = {
            // First take = most recent = program B.
            let program_b = test_scenario::take_shared<StampProgram>(&scenario);
            let id = sui::object::id(&program_b);
            test_scenario::return_shared(program_b);

            // Second take = program A.
            let mut program_a = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::create_card_and_stamp(&mut program_a, CUSTOMER, &test_clock, scenario.ctx());
            test_scenario::return_shared(program_a);
            id
        };

        // Customer passes program B when redeeming a card tied to program A
        // — must abort with EProgramMismatch.
        scenario.next_tx(CUSTOMER);
        {
            let program_b = test_scenario::take_shared_by_id<StampProgram>(&scenario, program_b_id);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program_b, &mut card, scenario.ctx());
            test_scenario::return_shared(card);
            test_scenario::return_shared(program_b);
        };

        clock::destroy_for_testing(test_clock);
        scenario.end();
    }
}
