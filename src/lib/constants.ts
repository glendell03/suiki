import { env } from "@/env";

/**
 * Active SUI network, resolved from the validated NEXT_PUBLIC_SUI_NETWORK env variable.
 * Safe to use in both Server and Client Components.
 */
export const SUI_NETWORK = env.NEXT_PUBLIC_SUI_NETWORK;

/**
 * Deployed Move package ID on the SUI network.
 * Set to the real address after deployment.
 * Safe to use in both Server and Client Components.
 */
export const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID;

/** The Move module name inside the suiki package. */
export const MODULE_NAME = 'suiki' as const;

// ---------------------------------------------------------------------------
// Move function targets
// ---------------------------------------------------------------------------

/**
 * Fully-qualified Move call targets for every public function in the suiki module.
 * Format: `{PACKAGE_ID}::{MODULE_NAME}::{function_name}`
 *
 * Used by the transaction builders in src/lib/transactions.ts.
 */
export const TARGETS = {
  createProgram: `${PACKAGE_ID}::${MODULE_NAME}::create_program`,
  createCardAndStamp: `${PACKAGE_ID}::${MODULE_NAME}::create_card_and_stamp`,
  issueStamp: `${PACKAGE_ID}::${MODULE_NAME}::issue_stamp`,
  redeem: `${PACKAGE_ID}::${MODULE_NAME}::redeem`,
  updateProgram: `${PACKAGE_ID}::${MODULE_NAME}::update_program`,
  // SEC-10: these two were missing from TARGETS but present in the sponsor API allowlist.
  // Always define targets here so PACKAGE_ID changes propagate automatically.
  syncCardMetadata: `${PACKAGE_ID}::${MODULE_NAME}::sync_card_metadata`,
  transferMerchant: `${PACKAGE_ID}::${MODULE_NAME}::transfer_merchant`,
} as const;

// ---------------------------------------------------------------------------
// SUI system object IDs
// ---------------------------------------------------------------------------

/**
 * The SUI system Clock shared object.
 * Always at address 0x6 on every SUI network.
 */
export const CLOCK_ID = '0x6' as const;

// ---------------------------------------------------------------------------
// Move event type strings
// ---------------------------------------------------------------------------

/**
 * Fully-qualified Move event type strings used when filtering queryEvents results.
 */
export const EVENT_TYPES = {
  programCreated: `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated`,
  cardCreated: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated`,
  stampIssued: `${PACKAGE_ID}::${MODULE_NAME}::StampIssued`,
  stampRedeemed: `${PACKAGE_ID}::${MODULE_NAME}::StampRedeemed`,
  programUpdated: `${PACKAGE_ID}::${MODULE_NAME}::ProgramUpdated`,
} as const;
