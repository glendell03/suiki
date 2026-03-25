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
 *   - Accept a typed params object (no positional arguments)
 *   - Create a new Transaction
 *   - Add exactly one moveCall matching the Move function signature
 *   - Return the Transaction for the caller to sign and execute
 *
 * TODO: install @mysten/sui @mysten/dapp-kit
 * npm install @mysten/sui @mysten/dapp-kit @tanstack/react-query
 */

// TODO: uncomment after running: npm install @mysten/sui
// import { Transaction } from '@mysten/sui/transactions';
import { TARGETS, CLOCK_ID } from './constants';

// ---------------------------------------------------------------------------
// Stub type — replace with real import once @mysten/sui is installed
// ---------------------------------------------------------------------------

/**
 * Minimal Transaction interface matching the @mysten/sui Transaction API.
 * Remove this stub and uncomment the real import once dependencies are installed.
 */
export interface TransactionInterface {
  moveCall(params: {
    target: string;
    arguments?: unknown[];
    typeArguments?: string[];
  }): unknown;
  pure: {
    string(value: string): unknown;
    u64(value: number | bigint): unknown;
    address(value: string): unknown;
    bool(value: boolean): unknown;
  };
  object(id: string): unknown;
  build(options?: { client?: unknown; onlyTransactionKind?: boolean }): Promise<Uint8Array>;
}

/**
 * Creates a new Transaction instance.
 *
 * After installing @mysten/sui, replace this function body with:
 *   import { Transaction } from '@mysten/sui/transactions';
 *   return new Transaction();
 */
function newTransaction(): TransactionInterface {
  throw new Error(
    'Transaction is not available. ' +
      'Run "npm install @mysten/sui" and replace the stub in src/lib/transactions.ts.',
  );
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

/** Parameters for creating a new stamp program. */
export interface CreateProgramParams {
  /** Display name of the stamp program (e.g. "Kape ni Juan"). */
  name: string;
  /** URL of the merchant's logo image. */
  logoUrl: string;
  /** Number of stamps required before a customer can redeem. */
  stampsRequired: number;
  /** Human-readable reward description (e.g. "Free brewed coffee"). */
  rewardDescription: string;
}

/**
 * Builds a transaction that calls suiki::suiki::create_program.
 *
 * The caller (merchant) must sign this transaction. The new StampProgram
 * becomes a shared object accessible by any address.
 *
 * Move signature:
 *   public fun create_program(name, logo_url, stamps_required, reward_description, ctx)
 */
export function buildCreateProgram(params: CreateProgramParams): TransactionInterface {
  const tx = newTransaction();
  tx.moveCall({
    target: TARGETS.createProgram,
    arguments: [
      tx.pure.string(params.name),
      tx.pure.string(params.logoUrl),
      tx.pure.u64(params.stampsRequired),
      tx.pure.string(params.rewardDescription),
    ],
  });
  return tx;
}

/** Parameters for creating a new stamp card and issuing the first stamp. */
export interface CreateCardAndStampParams {
  /**
   * Object ID of the StampProgram shared object.
   * Passed as a mutable reference — the program's total_issued counter is incremented.
   */
  programId: string;
  /**
   * Wallet address of the customer receiving the card.
   * The merchant scans the customer's QR code to obtain this value.
   */
  customerAddress: string;
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
 */
export function buildCreateCardAndStamp(params: CreateCardAndStampParams): TransactionInterface {
  const tx = newTransaction();
  tx.moveCall({
    target: TARGETS.createCardAndStamp,
    arguments: [
      tx.object(params.programId),
      tx.pure.address(params.customerAddress),
      // The SUI system clock object is always at 0x6.
      // It is passed as a shared object reference so the contract can call
      // clock.timestamp_ms() to record when the stamp was issued.
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** Parameters for issuing a stamp on an existing card. */
export interface IssueStampParams {
  /**
   * Object ID of the StampProgram shared object.
   * Must match the program that issued the card (program_id assertion in Move).
   */
  programId: string;
  /** Object ID of the customer's StampCard shared object. */
  cardId: string;
}

/**
 * Builds a transaction that calls suiki::suiki::issue_stamp.
 *
 * The caller must be the merchant. Increments card.current_stamps by 1 and
 * updates card.last_stamped with the current clock timestamp.
 *
 * Move signature:
 *   public fun issue_stamp(program: &mut StampProgram, card: &mut StampCard, clock, ctx)
 */
export function buildIssueStamp(params: IssueStampParams): TransactionInterface {
  const tx = newTransaction();
  tx.moveCall({
    target: TARGETS.issueStamp,
    arguments: [
      tx.object(params.programId),
      tx.object(params.cardId),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** Parameters for redeeming accumulated stamps. */
export interface RedeemParams {
  /**
   * Object ID of the StampProgram shared object.
   * Passed as an immutable reference — the program is not modified during redemption.
   */
  programId: string;
  /** Object ID of the customer's StampCard shared object. */
  cardId: string;
}

/**
 * Builds a transaction that calls suiki::suiki::redeem.
 *
 * The caller must be the customer (card.customer == ctx.sender()).
 * Requires card.current_stamps >= program.stamps_required.
 * Resets current_stamps to 0 and increments total_earned.
 *
 * Move signature:
 *   public fun redeem(program: &StampProgram, card: &mut StampCard, ctx)
 */
export function buildRedeem(params: RedeemParams): TransactionInterface {
  const tx = newTransaction();
  tx.moveCall({
    target: TARGETS.redeem,
    arguments: [
      tx.object(params.programId),
      tx.object(params.cardId),
    ],
  });
  return tx;
}

/** Parameters for updating an existing stamp program. */
export interface UpdateProgramParams {
  /** Object ID of the StampProgram to update. */
  programId: string;
  /** New display name (replaces the existing name). */
  name: string;
  /** New logo URL (replaces the existing logo_url). */
  logoUrl: string;
  /** New reward description (replaces the existing reward_description). */
  rewardDescription: string;
}

/**
 * Builds a transaction that calls suiki::suiki::update_program.
 *
 * The caller must be the merchant. Updates name, logo_url, and reward_description.
 * Note: stamps_required cannot be changed after creation to protect existing cardholders.
 *
 * Move signature:
 *   public fun update_program(program: &mut StampProgram, name, logo_url, reward_description, ctx)
 */
export function buildUpdateProgram(params: UpdateProgramParams): TransactionInterface {
  const tx = newTransaction();
  tx.moveCall({
    target: TARGETS.updateProgram,
    arguments: [
      tx.object(params.programId),
      tx.pure.string(params.name),
      tx.pure.string(params.logoUrl),
      tx.pure.string(params.rewardDescription),
    ],
  });
  return tx;
}
