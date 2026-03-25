/**
 * TypeScript types mirroring the Suiki Move contract objects, events, and API shapes.
 *
 * Move module: suiki::suiki
 * Source of truth: move/suiki/sources/suiki.move
 *
 * Design decisions:
 * - Branded types for SuiAddress and SuiObjectId prevent accidentally swapping
 *   an address for an object ID at the type level.
 * - u64 fields use `number` — JavaScript safely handles integers up to 2^53-1,
 *   which is far beyond any realistic stamp count or timestamp in this app.
 * - Raw shapes (SuiRawStampProgram / SuiRawStampCard) mirror what the RPC returns
 *   from getObject / multiGetObjects (snake_case string fields). Parsed shapes
 *   (StampProgram / StampCard) use camelCase and proper types for app consumption.
 * - QR payload types are kept minimal: merchant QR encodes the program ID so the
 *   customer can look it up; customer QR encodes the customer's wallet address so
 *   the merchant can issue a stamp.
 * - SponsoredTxRequest / SponsoredTxResponse match the /api/sponsor route contract
 *   defined in src/app/api/sponsor/route.ts.
 */

// ---------------------------------------------------------------------------
// Branded primitives
// ---------------------------------------------------------------------------

/** A SUI wallet address (0x-prefixed hex string). */
export type SuiAddress = string & { readonly __brand: 'SuiAddress' };

/** A SUI object ID (0x-prefixed hex string). */
export type SuiObjectId = string & { readonly __brand: 'SuiObjectId' };

/**
 * Cast a plain string to a SuiAddress.
 * Use only when you know the string is a valid SUI address (e.g., from wallet or RPC).
 */
export const asSuiAddress = (value: string): SuiAddress => value as SuiAddress;

/**
 * Cast a plain string to a SuiObjectId.
 * Use only when you know the string is a valid SUI object ID (e.g., from RPC response).
 */
export const asSuiObjectId = (value: string): SuiObjectId => value as SuiObjectId;

// ---------------------------------------------------------------------------
// Raw RPC shapes — what the SUI RPC returns in object content fields
// ---------------------------------------------------------------------------

/**
 * Raw field shape returned by SuiClient.getObject / multiGetObjects for a
 * StampProgram shared object. All values are strings because the RPC serialises
 * u64 as strings to avoid JavaScript precision loss.
 */
export interface SuiRawStampProgram {
  /** Object UID serialised as hex string. */
  id: { id: string };
  merchant: string;
  name: string;
  logo_url: string;
  /** u64 serialised as string. */
  stamps_required: string;
  reward_description: string;
  /** u64 serialised as string. */
  total_issued: string;
}

/**
 * Raw field shape returned by SuiClient for a StampCard shared object.
 * program_id is an inner ID struct, not a UID.
 */
export interface SuiRawStampCard {
  id: { id: string };
  /** Inner ID struct — access via .id property. */
  program_id: string;
  customer: string;
  merchant_name: string;
  merchant_logo: string;
  stamps_required: string;
  current_stamps: string;
  total_earned: string;
  /** Unix milliseconds as string. */
  last_stamped: string;
}

// ---------------------------------------------------------------------------
// Parsed application types
// ---------------------------------------------------------------------------

/**
 * A merchant's loyalty stamp program.
 * Mirrors the Move StampProgram shared object, with camelCase fields and
 * proper TypeScript types.
 */
export interface StampProgram {
  /** On-chain object ID of this StampProgram shared object. */
  objectId: SuiObjectId;
  /** Wallet address of the merchant who owns this program. */
  merchant: SuiAddress;
  /** Display name of the stamp program (e.g. "Kape ni Juan"). */
  name: string;
  /** URL of the merchant's logo image. */
  logoUrl: string;
  /** Number of stamps a customer must collect before redeeming. */
  stampsRequired: number;
  /** Human-readable description of the reward (e.g. "Free brewed coffee"). */
  rewardDescription: string;
  /** Cumulative count of stamps ever issued across all cards in this program. */
  totalIssued: number;
}

/**
 * A customer's stamp card NFT for a specific program.
 * Mirrors the Move StampCard shared object. Implements the SUI Display standard
 * so wallets can render it as an NFT.
 */
export interface StampCard {
  /** On-chain object ID of this StampCard shared object. */
  objectId: SuiObjectId;
  /** Object ID of the StampProgram this card belongs to. */
  programId: SuiObjectId;
  /** Wallet address of the customer who owns this card. */
  customer: SuiAddress;
  /** Snapshot of the merchant's name at card creation time. */
  merchantName: string;
  /** Snapshot of the merchant's logo URL at card creation time. */
  merchantLogo: string;
  /** Stamps required to redeem (snapshotted from program at card creation). */
  stampsRequired: number;
  /** Current stamp count. Resets to 0 after each redemption. */
  currentStamps: number;
  /** Total stamps ever earned across all redemption cycles. */
  totalEarned: number;
  /** Unix timestamp (ms) of the most recent stamp issuance. */
  lastStamped: number;
}

// ---------------------------------------------------------------------------
// Event types — Move on-chain events emitted by the suiki module
// ---------------------------------------------------------------------------

/**
 * Emitted when a merchant calls create_program.
 * Move type: suiki::suiki::ProgramCreated
 */
export interface ProgramCreatedEvent {
  program_id: string;
  merchant: string;
  name: string;
}

/**
 * Emitted when a merchant calls create_card_and_stamp for a new customer.
 * Move type: suiki::suiki::CardCreated
 */
export interface CardCreatedEvent {
  card_id: string;
  program_id: string;
  customer: string;
}

/**
 * Emitted on every successful stamp issuance (both create_card_and_stamp
 * and issue_stamp emit this event).
 * Move type: suiki::suiki::StampIssued
 */
export interface StampIssuedEvent {
  card_id: string;
  program_id: string;
  customer: string;
  /** The card's current_stamps value after this stamp was issued. */
  new_count: number;
}

/**
 * Emitted when a customer calls redeem successfully.
 * Move type: suiki::suiki::StampRedeemed
 */
export interface StampRedeemedEvent {
  card_id: string;
  program_id: string;
  customer: string;
  /** The card's total_earned value after this redemption cycle. */
  total_earned: number;
}

/**
 * Emitted when a merchant calls update_program.
 * Move type: suiki::suiki::ProgramUpdated
 */
export interface ProgramUpdatedEvent {
  program_id: string;
  name: string;
  logo_url: string;
}

/** Union of all Suiki event payloads. Useful for generic event handling. */
export type SuikiEvent =
  | ProgramCreatedEvent
  | CardCreatedEvent
  | StampIssuedEvent
  | StampRedeemedEvent
  | ProgramUpdatedEvent;

// ---------------------------------------------------------------------------
// QR code payload types
// ---------------------------------------------------------------------------

/**
 * Payload encoded in a merchant's QR code.
 *
 * Flow: merchant displays this QR → customer scans it → app fetches program
 * details from the chain using programId.
 *
 * The `type` discriminant is included so the scanner can reject a customer QR
 * shown in the wrong context.
 */
export interface MerchantQRPayload {
  /** Discriminant — must be "merchant". */
  type: 'merchant';
  /** On-chain object ID of the StampProgram shared object. */
  programId: SuiObjectId;
  /** Wallet address of the merchant (redundant but useful for display without a fetch). */
  merchantAddress: SuiAddress;
}

/**
 * Payload encoded in a customer's QR code.
 *
 * Flow: customer displays this QR → merchant scans it → app calls
 * create_card_and_stamp or issue_stamp using the customer's address.
 *
 * The `type` discriminant prevents a merchant QR from being accepted as a
 * customer QR in the scanner.
 */
export interface CustomerQRPayload {
  /** Discriminant — must be "customer". */
  type: 'customer';
  /** Customer's wallet address — used as the `customer` argument in Move calls. */
  customerAddress: SuiAddress;
}

/** Union of QR payload types. Use the `type` field as a discriminant. */
export type QRPayload = MerchantQRPayload | CustomerQRPayload;

// ---------------------------------------------------------------------------
// Gas station API types — /api/sponsor endpoint
// ---------------------------------------------------------------------------

/**
 * Request body sent by the client to the /api/sponsor endpoint.
 *
 * The client builds a transaction with onlyTransactionKind: true (no gas info),
 * base64-encodes the bytes, and sends them here along with the sender address.
 * The sponsor API adds gas payment and returns a signed transaction.
 */
export interface SponsoredTxRequest {
  /** Base64-encoded transaction kind bytes (built with onlyTransactionKind: true). */
  txKindBytes: string;
  /** Wallet address of the transaction sender (the user, not the sponsor). */
  sender: SuiAddress;
}

/**
 * Successful response from the /api/sponsor endpoint.
 *
 * The client must collect a second signature from the user's wallet, then
 * call executeTransactionBlock with [userSignature, sponsorSignature].
 */
export interface SponsoredTxResponse {
  /** Base64-encoded full transaction bytes (with sender, gas owner, gas payment set). */
  transactionBytes: string;
  /**
   * Sponsor's signature over the transaction bytes.
   * Must be included alongside the user's signature when executing.
   */
  sponsorSignature: string;
}

/**
 * Error response from the /api/sponsor endpoint.
 * The HTTP status code will be 400 (bad request) or 500 (server error).
 */
export interface SponsoredTxErrorResponse {
  error: string;
}
