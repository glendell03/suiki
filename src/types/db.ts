import type { SuiObjectId, SuiAddress } from './sui';

/**
 * A StampProgram enriched with Postgres metadata.
 * Returned by GET /api/programs/[programId].
 */
export interface ProgramWithMetadata {
  programId: SuiObjectId;
  merchantAddress: SuiAddress;
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
  cardId: SuiObjectId;
  programId: SuiObjectId;
  customerAddress: SuiAddress;
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
