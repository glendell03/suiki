/**
 * Shared TypeScript types for the SUI blockchain domain.
 *
 * These interfaces mirror the Move contract structs on-chain so that
 * the TypeScript layer and the Move layer share a single source of truth
 * for field names and value semantics.
 */

/**
 * Represents a merchant loyalty programme deployed on the SUI blockchain.
 * Mirrors the `StampProgram` Move struct.
 */
export interface StampProgram {
  /** Object ID of the on-chain StampProgram object. */
  id: string;
  /** SUI address of the merchant who owns this programme. */
  merchantAddress: string;
  /** Human-readable name shown to customers. */
  name: string;
  /** Short description of the reward programme. */
  description: string;
  /** Number of stamps a customer must collect before redeeming a reward. */
  totalStampsRequired: number;
  /** Description of the reward granted upon full card completion. */
  reward: string;
  /** Whether the programme is currently accepting new stamp cards. */
  isActive: boolean;
}

/**
 * Represents a customer's individual stamp card for a specific programme.
 * Mirrors the `StampCard` Move struct.
 */
export interface StampCard {
  /** Object ID of the on-chain StampCard object. */
  id: string;
  /** Object ID of the parent StampProgram. */
  programId: string;
  /** SUI address of the customer who owns this card. */
  customerAddress: string;
  /** Number of stamps already collected on this card. */
  stampsCollected: number;
  /** Whether the reward on this card has been redeemed. */
  isRedeemed: boolean;
  /**
   * Unix timestamp (milliseconds) when this card was created.
   * Sourced from `tx_context::epoch_timestamp_ms` in the Move contract.
   */
  createdAt: number;
}

/** The set of SUI networks the application supports. */
export type SuiNetwork = "testnet" | "mainnet" | "devnet";
