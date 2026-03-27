#[test_only]
module suiki::suiki_tests {
    use sui::test_scenario;
    use sui::clock;
    use std::string;
    use suiki::suiki::{Self, StampProgram, StampCard, StafferCap};

    // ===== Test addresses =====

    const MERCHANT: address = @0xCAFE;
    const CUSTOMER: address = @0xBEEF;
    const OTHER: address = @0xDEAD;
    const NEW_MERCHANT: address = @0xF00D;
    const STAFFER: address = @0xA55E;

    // ===== Happy-path tests =====

    #[test]
    fun test_create_program() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(
            string::utf8(b"Kape ni Juan"),
            10,
            0,
            scenario.ctx(),
        );

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            assert!(suiki::program_merchant(&program) == MERCHANT);
            assert!(suiki::program_stamps_required(&program) == 10);
            assert!(suiki::program_total_issued(&program) == 0);
            assert!(suiki::program_name(&program) == string::utf8(b"Kape ni Juan"));
            assert!(suiki::program_is_active(&program) == true);
            assert!(suiki::program_version(&program) == 1);
            assert!(suiki::program_theme_id(&program) == 0);
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    fun test_create_card_and_stamp() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Kape ni Juan"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            assert!(suiki::program_total_issued(&program) == 1);
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(CUSTOMER);
        {
            let card = test_scenario::take_shared<StampCard>(&scenario);
            assert!(suiki::card_current_stamps(&card) == 1);
            assert!(suiki::card_total_earned(&card) == 0);
            assert!(suiki::card_customer(&card) == CUSTOMER);
            test_scenario::return_shared(card);
        };

        scenario.end();
    }

    #[test]
    fun test_issue_stamp() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }

    #[test]
    fun test_redeem() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 2, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 0);
            assert!(suiki::card_total_earned(&card) == 1);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
        };

        scenario.end();
    }

    #[test]
    fun test_redeem_carries_excess() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 2, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 3);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 1);
            assert!(suiki::card_total_earned(&card) == 1);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
        };

        scenario.end();
    }

    #[test]
    fun test_staffer_cap_happy_path() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::issue_staffer_cap(&program, STAFFER, scenario.ctx());
            test_scenario::return_shared(program);
        };

        scenario.next_tx(STAFFER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let cap = test_scenario::take_from_sender<StafferCap>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp_as_staffer(&cap, &program, &mut card, &clock, scenario.ctx());
            assert!(suiki::card_current_stamps(&card) == 2);
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            test_scenario::return_to_sender(&scenario, cap);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }

    #[test]
    fun test_deactivate_reactivate() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::deactivate_program(&mut program, scenario.ctx());
            assert!(suiki::program_is_active(&program) == false);
            suiki::reactivate_program(&mut program, scenario.ctx());
            assert!(suiki::program_is_active(&program) == true);
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    #[test]
    fun test_transfer_merchant() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            suiki::transfer_merchant(&mut program, NEW_MERCHANT, scenario.ctx());
            assert!(suiki::program_merchant(&program) == NEW_MERCHANT);
            test_scenario::return_shared(program);
        };

        scenario.end();
    }

    // ===== Failure tests =====

    #[test]
    #[expected_failure]
    fun test_create_program_zero_stamps_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        suiki::create_program(string::utf8(b"Coffee"), 0, 0, scenario.ctx());
        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_create_program_empty_name_fails() {
        let mut scenario = test_scenario::begin(MERCHANT);
        suiki::create_program(string::utf8(b""), 5, 0, scenario.ctx());
        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_not_enough_stamps_aborts() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(CUSTOMER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            suiki::redeem(&program, &mut card, scenario.ctx());
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_not_merchant_aborts() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(OTHER);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_stamp_on_inactive_program_aborts() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Coffee"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program, CUSTOMER, &clock, scenario.ctx());
            suiki::deactivate_program(&mut program, scenario.ctx());
            test_scenario::return_shared(program);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(MERCHANT);
        {
            let program = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program, &mut card, &clock, scenario.ctx());
            test_scenario::return_shared(program);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_program_mismatch_aborts() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Program A"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program_a = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program_a, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program_a);
            clock::destroy_for_testing(clock);
        };

        suiki::create_program(string::utf8(b"Program B"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let program_b = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::issue_stamp(&program_b, &mut card, &clock, scenario.ctx());
            test_scenario::return_shared(program_b);
            test_scenario::return_shared(card);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }

    #[test]
    #[expected_failure]
    fun test_staffer_cap_wrong_program_aborts() {
        let mut scenario = test_scenario::begin(MERCHANT);

        suiki::create_program(string::utf8(b"Program A"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program_a = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program_a, CUSTOMER, &clock, scenario.ctx());
            suiki::issue_staffer_cap(&program_a, STAFFER, scenario.ctx());
            test_scenario::return_shared(program_a);
            clock::destroy_for_testing(clock);
        };

        suiki::create_program(string::utf8(b"Program B"), 5, 0, scenario.ctx());

        scenario.next_tx(MERCHANT);
        {
            let mut program_b = test_scenario::take_shared<StampProgram>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            suiki::create_card_and_stamp(&mut program_b, CUSTOMER, &clock, scenario.ctx());
            test_scenario::return_shared(program_b);
            clock::destroy_for_testing(clock);
        };

        scenario.next_tx(STAFFER);
        {
            let program_b = test_scenario::take_shared<StampProgram>(&scenario);
            let mut card = test_scenario::take_shared<StampCard>(&scenario);
            let cap = test_scenario::take_from_sender<StafferCap>(&scenario);
            let clock = clock::create_for_testing(scenario.ctx());
            // cap is for Program A, but we pass Program B — should abort
            suiki::issue_stamp_as_staffer(&cap, &program_b, &mut card, &clock, scenario.ctx());
            test_scenario::return_shared(program_b);
            test_scenario::return_shared(card);
            test_scenario::return_to_sender(&scenario, cap);
            clock::destroy_for_testing(clock);
        };

        scenario.end();
    }
}
