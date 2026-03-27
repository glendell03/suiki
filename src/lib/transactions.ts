/**
 * Transaction builders for the Suiki Move contract.
 *
 * Each function constructs a Transaction object that can be:
 *   1. Passed directly to signAndExecuteTransaction (user pays gas), or
 *   2. Built with onlyTransactionKind: true and sent to /api/sponsor (gas sponsorship).
 *
 * Move module: suiki::suiki
 * Source of truth: move/suiki/sources/suiki.move
 *
 * All functions follow the same pattern:
 *   - Accept positional arguments (sender first, then Move function params)
 *   - Create a new Transaction and set the sender
 *   - Add exactly one moveCall matching the Move function signature
 *   - Return the Transaction for the caller to sign and execute
 */

import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID } from './constants';

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

/**
 * Builds a transaction that calls suiki::suiki::create_program.
 *
 * The caller (merchant) must sign this transaction. The new StampProgram
 * becomes a shared object accessible by any address.
 *
 * Move signature:
 *   public fun create_program(name, logo_url, stamps_required, reward_description, ctx)
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param name - Display name of the stamp program.
 * @param logoUrl - URL of the merchant's logo image.
 * @param stampsRequired - Number of stamps required before a customer can redeem.
 * @param rewardDescription - Human-readable reward description.
 */
export function buildCreateProgram(
  sender: string,
  name: string,
  logoUrl: string,
  stampsRequired: number,
  rewardDescription: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.createProgram,
    arguments: [
      tx.pure.string(name),
      tx.pure.string(logoUrl),
      tx.pure.u64(stampsRequired),
      tx.pure.string(rewardDescription),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::create_card_and_stamp.
 *
 * The caller must be the merchant (program.merchant == ctx.sender()).
 * Creates a new StampCard shared object with current_stamps = 1 and emits
 * both CardCreated and StampIssued events.
 *
 * Move signature:
 *   public fun create_card_and_stamp(program: &mut StampProgram, customer, clock, ctx)
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram shared object (mutable ref).
 * @param customerAddress - Wallet address of the customer receiving the card.
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
      // The SUI system clock object is always at 0x6.
      // Passed as a shared object reference so the contract can call
      // clock.timestamp_ms() to record when the stamp was issued.
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_stamp.
 *
 * The caller must be the merchant. Increments card.current_stamps by 1 and
 * updates card.last_stamped with the current clock timestamp.
 *
 * Move signature:
 *   public fun issue_stamp(program: &StampProgram, card: &mut StampCard, clock, ctx)
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram shared object (immutable ref).
 * @param cardId - Object ID of the customer's StampCard shared object (mutable ref).
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
 * Builds a transaction that calls suiki::suiki::redeem.
 *
 * The caller must be the customer (card.customer == ctx.sender()).
 * Requires card.current_stamps >= program.stamps_required.
 * Subtracts stamps_required from current_stamps (excess stamps carry forward)
 * and increments total_earned by 1 (counts completed redemption cycles).
 *
 * Move signature:
 *   public fun redeem(program: &StampProgram, card: &mut StampCard, ctx)
 *
 * @param sender - Customer wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram shared object (immutable ref).
 * @param cardId - Object ID of the customer's StampCard shared object (mutable ref).
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
 *
 * The caller must be the merchant. Updates name, logo_url, and reward_description.
 * Note: stamps_required cannot be changed after creation to protect existing cardholders.
 *
 * Move signature:
 *   public fun update_program(program: &mut StampProgram, name, logo_url, reward_description, ctx)
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram to update (mutable ref).
 * @param name - New display name.
 * @param logoUrl - New logo URL.
 * @param rewardDescription - New reward description.
 */
export function buildUpdateProgram(
  sender: string,
  programId: string,
  name: string,
  logoUrl: string,
  rewardDescription: string,
): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: TARGETS.updateProgram,
    arguments: [
      tx.object(programId),
      tx.pure.string(name),
      tx.pure.string(logoUrl),
      tx.pure.string(rewardDescription),
    ],
  });
  return tx;
}
