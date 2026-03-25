/**
 * TypeScript types mirroring the Suiki Move contract objects, events, and API shapes.
 *
 * Move module: suiki::suiki
 * Source of truth: move/suiki/sources/suiki.move
 */

// ---------------------------------------------------------------------------
// Branded primitives
// ---------------------------------------------------------------------------

/** A SUI wallet address (0x-prefixed hex string). */
export type SuiAddress = string & { readonly __brand: 'SuiAddress' };

/** A SUI object ID (0x-prefixed hex string). */
export type SuiObjectId = string & { readonly __brand: 'SuiObjectId' };

/** Cast a plain string to a SuiAddress. */
export const asSuiAddress = (value: string): SuiAddress => value as SuiAddress;

/** Cast a plain string to a SuiObjectId. */
export const asSuiObjectId = (value: string): SuiObjectId => value as SuiObjectId;

/** The set of SUI networks the application supports. */
export type SuiNetwork = "testnet" | "mainnet" | "devnet";

// ---------------------------------------------------------------------------
// Raw RPC shapes — what the SUI RPC returns in object content fields
// ---------------------------------------------------------------------------

/**
 * Raw field shape returned by SuiClient for a StampProgram shared object.
 * All u64 values are serialised as strings by the RPC.
 */
export interface SuiRawStampProgram {
  id: { id: string };
  merchant: string;
  name: string;
  logo_url: string;
  stamps_required: string;
  reward_description: string;
  total_issued: string;
}

/**
 * Raw field shape returned by SuiClient for a StampCard shared object.
 */
export interface SuiRawStampCard {
  id: { id: string };
  program_id: string;
  customer: string;
  merchant_name: string;
  merchant_logo: string;
  stamps_required: string;
  current_stamps: string;
  total_earned: string;
  last_stamped: string;
}

// ---------------------------------------------------------------------------
// Parsed application types
// ---------------------------------------------------------------------------

/**
 * A merchant's loyalty stamp program.
 * Mirrors the Move StampProgram shared object.
 */
export interface StampProgram {
  objectId: SuiObjectId;
  merchant: SuiAddress;
  name: string;
  logoUrl: string;
  stampsRequired: number;
  rewardDescription: string;
  totalIssued: number;
}

/**
 * A customer's stamp card for a specific program.
 * Mirrors the Move StampCard shared object.
 */
export interface StampCard {
  objectId: SuiObjectId;
  programId: SuiObjectId;
  customer: SuiAddress;
  merchantName: string;
  merchantLogo: string;
  stampsRequired: number;
  currentStamps: number;
  totalEarned: number;
  lastStamped: number;
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface ProgramCreatedEvent {
  program_id: string;
  merchant: string;
  name: string;
}

export interface CardCreatedEvent {
  card_id: string;
  program_id: string;
  customer: string;
}

export interface StampIssuedEvent {
  card_id: string;
  program_id: string;
  customer: string;
  new_count: number;
}

export interface StampRedeemedEvent {
  card_id: string;
  program_id: string;
  customer: string;
  total_earned: number;
}

export interface ProgramUpdatedEvent {
  program_id: string;
  name: string;
  logo_url: string;
}

export type SuikiEvent =
  | ProgramCreatedEvent
  | CardCreatedEvent
  | StampIssuedEvent
  | StampRedeemedEvent
  | ProgramUpdatedEvent;

// ---------------------------------------------------------------------------
// QR code payload types
// ---------------------------------------------------------------------------

export interface MerchantQRPayload {
  type: 'merchant';
  programId: SuiObjectId;
  merchantAddress: SuiAddress;
}

export interface CustomerQRPayload {
  type: 'customer';
  customerAddress: SuiAddress;
}

export type QRPayload = MerchantQRPayload | CustomerQRPayload;

// ---------------------------------------------------------------------------
// Gas station API types — /api/sponsor endpoint
// ---------------------------------------------------------------------------

export interface SponsoredTxRequest {
  txKindBytes: string;
  sender: SuiAddress;
}

export interface SponsoredTxResponse {
  transactionBytes: string;
  sponsorSignature: string;
}

export interface SponsoredTxErrorResponse {
  error: string;
}
