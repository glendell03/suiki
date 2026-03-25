/**
 * Network and contract constants for the Suiki app.
 *
 * Environment variables are read at module load time. Ensure the following are
 * set in .env.local before running the dev server or deploying:
 *
 *   NEXT_PUBLIC_SUI_NETWORK   — "testnet" | "mainnet" | "devnet"  (default: "testnet")
 *   NEXT_PUBLIC_PACKAGE_ID    — The 0x-prefixed package ID after deploying the Move contract
 *
 * The NEXT_PUBLIC_ prefix makes these values available in both server and client
 * bundles. Never put secrets (e.g. SPONSOR_PRIVATE_KEY) under NEXT_PUBLIC_.
 *
 * TODO: install @mysten/sui @mysten/dapp-kit
 */

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

/** Supported SUI networks. Matches getFullnodeUrl() parameter type in @mysten/sui. */
export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet';

/**
 * Active SUI network, resolved from the NEXT_PUBLIC_SUI_NETWORK environment
 * variable. Falls back to "testnet" when the variable is not set.
 */
export const SUI_NETWORK: SuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork | undefined) ?? 'testnet';

// ---------------------------------------------------------------------------
// Contract identity
// ---------------------------------------------------------------------------

/**
 * Deployed package ID on the active network.
 * Populated from NEXT_PUBLIC_PACKAGE_ID after running `sui client publish`.
 * The value is a placeholder until the contract is deployed in Task 4.
 */
export const PACKAGE_ID: string = process.env.NEXT_PUBLIC_PACKAGE_ID ?? '0x_PLACEHOLDER';

/** The Move module name inside the suiki package. */
export const MODULE_NAME = 'suiki' as const;

// ---------------------------------------------------------------------------
// Move function targets
// ---------------------------------------------------------------------------

/**
 * Fully-qualified Move call targets for every public function in the suiki module.
 * Format: `{PACKAGE_ID}::{MODULE_NAME}::{function_name}`
 *
 * These are used by the transaction builders in src/lib/transactions.ts.
 */
export const TARGETS = {
  /** suiki::suiki::create_program — merchant creates a new stamp program. */
  createProgram: `${PACKAGE_ID}::${MODULE_NAME}::create_program`,
  /** suiki::suiki::create_card_and_stamp — merchant creates a card for a new customer. */
  createCardAndStamp: `${PACKAGE_ID}::${MODULE_NAME}::create_card_and_stamp`,
  /** suiki::suiki::issue_stamp — merchant issues a stamp to an existing card. */
  issueStamp: `${PACKAGE_ID}::${MODULE_NAME}::issue_stamp`,
  /** suiki::suiki::redeem — customer redeems accumulated stamps for a reward. */
  redeem: `${PACKAGE_ID}::${MODULE_NAME}::redeem`,
  /** suiki::suiki::update_program — merchant updates name, logo, or reward description. */
  updateProgram: `${PACKAGE_ID}::${MODULE_NAME}::update_program`,
} as const;

// ---------------------------------------------------------------------------
// SUI system object IDs
// ---------------------------------------------------------------------------

/**
 * The SUI system Clock shared object.
 * Always at address 0x6 on every SUI network.
 * Passed as a read-only argument to create_card_and_stamp and issue_stamp
 * so the contract can record the timestamp of each stamp.
 */
export const CLOCK_ID = '0x6' as const;

// ---------------------------------------------------------------------------
// Move event type strings
// ---------------------------------------------------------------------------

/**
 * Fully-qualified Move event type strings used when filtering queryEvents results.
 * Format: `{PACKAGE_ID}::{MODULE_NAME}::{EventStruct}`
 */
export const EVENT_TYPES = {
  programCreated: `${PACKAGE_ID}::${MODULE_NAME}::ProgramCreated`,
  cardCreated: `${PACKAGE_ID}::${MODULE_NAME}::CardCreated`,
  stampIssued: `${PACKAGE_ID}::${MODULE_NAME}::StampIssued`,
  stampRedeemed: `${PACKAGE_ID}::${MODULE_NAME}::StampRedeemed`,
  programUpdated: `${PACKAGE_ID}::${MODULE_NAME}::ProgramUpdated`,
} as const;
