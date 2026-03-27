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
import { TARGETS, CLOCK_ID, PREMIUM_THEME_PRICE_MIST } from './constants';

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

/**
 * Builds a transaction that calls suiki::suiki::create_program.
 * V3: logo_url and reward_description moved to Postgres — not on-chain.
 *
 * @param params.name - Display name of the stamp program.
 * @param params.stampsRequired - Number of stamps required before a customer can redeem.
 * @param params.themeId - Optional visual theme identifier for the stamp card (default 0).
 */
export function buildCreateProgram(params: {
  name: string;
  stampsRequired: number;
  themeId?: number;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: TARGETS.createProgram,
    arguments: [
      tx.pure.string(params.name),
      tx.pure.u64(params.stampsRequired),
      tx.pure.u8(params.themeId ?? 0),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::create_card_and_stamp.
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
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_stamp.
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
 * Builds a transaction that calls suiki::suiki::issue_stamp_as_staffer.
 * Requires the caller to hold the StafferCap for this program.
 *
 * @param sender - Staffer wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram shared object.
 * @param cardId - Object ID of the customer's StampCard shared object.
 * @param stafferCapId - Object ID of the caller's StafferCap.
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
 * V3: only updates the on-chain name. Use PUT /api/merchant/programs/[id] to update
 * logo_url and reward_description in Postgres.
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram to update (mutable ref).
 * @param name - New display name.
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
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram to update.
 * @param themeId - New theme identifier.
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
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram to deactivate.
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
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram to reactivate.
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
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram.
 * @param stafferAddress - Wallet address of the staffer to receive the cap.
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
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 */
export function buildCreateMerchantProfile(sender: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({ target: TARGETS.createAndTransferMerchantProfile });
  return tx;
}

/**
 * Builds a PTB that creates a MerchantProfile and purchases a premium theme atomically.
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param themeId - Premium theme identifier to purchase.
 */
export function buildCreateProfileAndPurchaseTheme(sender: string, themeId: number): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const profile = tx.moveCall({ target: TARGETS.createMerchantProfile })[0]!;
  const payment = tx.splitCoins(tx.gas, [tx.pure.u64(PREMIUM_THEME_PRICE_MIST)])[0]!;
  tx.moveCall({
    target: TARGETS.purchaseTheme,
    arguments: [profile, tx.pure.u8(themeId), payment],
  });
  tx.transferObjects([profile], tx.pure.address(sender));
  return tx;
}

/**
 * Builds a transaction that purchases a premium theme on an existing MerchantProfile.
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param profileId - Object ID of the existing MerchantProfile.
 * @param themeId - Premium theme identifier to purchase.
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
 * Requires the caller to own a MerchantProfile with the theme purchased.
 *
 * @param sender - Merchant wallet address (0x-prefixed).
 * @param programId - Object ID of the StampProgram.
 * @param profileId - Object ID of the MerchantProfile proving theme ownership.
 * @param themeId - Premium theme identifier to apply.
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
