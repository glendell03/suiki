/**
 * DB-layer API response types.
 *
 * These are plain-string types returned from Postgres — not branded on-chain types.
 * IDs are SUI object ID strings (0x-prefixed hex) but typed as `string` here
 * because the branded SuiObjectId type is incompatible with DB-layer values.
 */

/**
 * A StampProgram enriched with Postgres metadata.
 * Returned by GET /api/programs/[programId].
 */
export interface ProgramWithMetadata {
  programId: string;
  merchantAddress: string;
  name: string;
  logoUrl: string;
  rewardDescription: string;
  stampsRequired: number;
  isActive: boolean;
  themeId: number;
}

/**
 * A StampCard enriched with program metadata from Postgres.
 * Returned by GET /api/customer/[wallet]/cards.
 */
export interface CardWithProgram {
  cardId: string;
  programId: string;
  customerAddress: string;
  currentStamps: number;
  stampsRequired: number;
  totalEarned: number;
  lastStampedAt: string | null;
  /** Enriched from programs table */
  merchantName: string;
  logoUrl: string;
  rewardDescription: string;
  isActive: boolean;
  themeId: number;
}
