/**
 * Sui event handlers for the Suiki indexer.
 *
 * Each handler receives a raw Sui event and upserts the corresponding
 * Postgres row via Drizzle. All handlers are **idempotent** — they use
 * INSERT ... ON CONFLICT DO UPDATE so replaying the same event is safe.
 *
 * The `dispatchEvent` function routes an event to the correct handler
 * based on its fully-qualified Move type string.
 */

import { db } from '@/lib/db';
import { programs, cards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EVENT_TYPES } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Event shape coming from SUI RPC queryEvents
// ---------------------------------------------------------------------------

/** Minimal shape of a Sui event as returned by queryEvents. */
interface SuiEvent {
  type: string;
  parsedJson: Record<string, unknown>;
  timestampMs?: string;
}

// ---------------------------------------------------------------------------
// Payload interfaces (snake_case — matches Move event field names)
// ---------------------------------------------------------------------------

interface ProgramCreatedPayload {
  program_id: string;
  merchant: string;
  name: string;
  stamps_required: number;
}

interface ProgramUpdatedPayload {
  program_id: string;
  name: string;
}

interface ProgramDeactivatedPayload {
  program_id: string;
}

interface ProgramReactivatedPayload {
  program_id: string;
}

interface CardCreatedPayload {
  card_id: string;
  program_id: string;
  customer: string;
}

interface StampIssuedPayload {
  card_id: string;
  program_id: string;
  customer: string;
  new_count: number;
}

interface StampRedeemedPayload {
  card_id: string;
  program_id: string;
  customer: string;
  redemption_count: number;
  remaining_stamps: number;
}

interface ThemeChangedPayload {
  program_id: string;
  new_theme_id: number;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handle ProgramCreated — inserts a new program row.
 * logoUrl and rewardDescription are left empty; the merchant fills them
 * via the POST /api/merchant/programs endpoint.
 */
export async function handleProgramCreated(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as ProgramCreatedPayload;

  await db
    .insert(programs)
    .values({
      programId: p.program_id,
      merchantAddress: p.merchant,
      name: p.name,
      stampsRequired: p.stamps_required,
      logoUrl: '',
      rewardDescription: '',
      isActive: true,
      themeId: 0,
    })
    .onConflictDoUpdate({
      target: programs.programId,
      set: {
        merchantAddress: p.merchant,
        name: p.name,
        stampsRequired: p.stamps_required,
        updatedAt: new Date(),
      },
    });
}

/**
 * Handle CardCreated — inserts a new card row.
 * currentStamps starts at 1 because create_card_and_stamp issues the first stamp.
 */
export async function handleCardCreated(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as CardCreatedPayload;

  await db
    .insert(cards)
    .values({
      cardId: p.card_id,
      programId: p.program_id,
      customerAddress: p.customer,
      currentStamps: 1,
      totalEarned: 0,
      lastStampedAt: event.timestampMs
        ? new Date(Number(event.timestampMs))
        : null,
    })
    .onConflictDoUpdate({
      target: cards.cardId,
      set: {
        currentStamps: 1,
        lastStampedAt: event.timestampMs
          ? new Date(Number(event.timestampMs))
          : null,
        },
    });
}

/**
 * Handle StampIssued — updates current stamp count and last-stamped timestamp.
 * Uses the authoritative `new_count` from the on-chain event rather than
 * incrementing locally (avoids stale-state bugs).
 */
export async function handleStampIssued(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as StampIssuedPayload;

  await db
    .update(cards)
    .set({
      currentStamps: p.new_count,
      lastStampedAt: event.timestampMs
        ? new Date(Number(event.timestampMs))
        : new Date(),
    })
    .where(eq(cards.cardId, p.card_id));
}

/**
 * Handle StampRedeemed — resets stamps to carry-forward value and bumps totalEarned.
 * Both values come directly from the on-chain event payload (authoritative).
 */
export async function handleStampRedeemed(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as StampRedeemedPayload;

  await db
    .update(cards)
    .set({
      currentStamps: p.remaining_stamps,
      totalEarned: p.redemption_count,
    })
    .where(eq(cards.cardId, p.card_id));
}

/**
 * Handle ProgramUpdated — updates the program name.
 * Logo and description are managed via the API, not the chain.
 */
export async function handleProgramUpdated(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as ProgramUpdatedPayload;

  await db
    .update(programs)
    .set({ name: p.name, updatedAt: new Date() })
    .where(eq(programs.programId, p.program_id));
}

/** Handle ProgramDeactivated — sets isActive to false. */
export async function handleProgramDeactivated(
  event: SuiEvent,
): Promise<void> {
  const p = event.parsedJson as unknown as ProgramDeactivatedPayload;

  await db
    .update(programs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(programs.programId, p.program_id));
}

/** Handle ProgramReactivated — sets isActive to true. */
export async function handleProgramReactivated(
  event: SuiEvent,
): Promise<void> {
  const p = event.parsedJson as unknown as ProgramReactivatedPayload;

  await db
    .update(programs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(programs.programId, p.program_id));
}

/** Handle ThemeChanged — updates the program's themeId. */
export async function handleThemeChanged(event: SuiEvent): Promise<void> {
  const p = event.parsedJson as unknown as ThemeChangedPayload;

  await db
    .update(programs)
    .set({ themeId: p.new_theme_id, updatedAt: new Date() })
    .where(eq(programs.programId, p.program_id));
}

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------

/** Map from fully-qualified Move event type to its handler function. */
const handlerMap: Record<string, (event: SuiEvent) => Promise<void>> = {
  [EVENT_TYPES.programCreated]: handleProgramCreated,
  [EVENT_TYPES.cardCreated]: handleCardCreated,
  [EVENT_TYPES.stampIssued]: handleStampIssued,
  [EVENT_TYPES.stampRedeemed]: handleStampRedeemed,
  [EVENT_TYPES.programUpdated]: handleProgramUpdated,
  [EVENT_TYPES.programDeactivated]: handleProgramDeactivated,
  [EVENT_TYPES.programReactivated]: handleProgramReactivated,
};

/**
 * Route a raw Sui event to the appropriate handler based on its type.
 * Unknown event types are silently skipped — this is intentional so the
 * indexer does not crash on unrecognised events from future contract upgrades.
 */
export async function dispatchEvent(event: SuiEvent): Promise<void> {
  const handler = handlerMap[event.type];

  if (handler) {
    await handler(event);
  }
}
