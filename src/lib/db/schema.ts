import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  smallint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Merchant program metadata — stores off-chain data removed from the V3 Move contract.
 * program_id is the SUI shared-object ID (0x-prefixed, 66 chars).
 */
export const programs = pgTable('programs', {
  programId: text('program_id').primaryKey(),
  merchantAddress: text('merchant_address').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  logoUrl: text('logo_url').notNull(),
  rewardDescription: text('reward_description').notNull(),
  stampsRequired: integer('stamps_required').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  themeId: smallint('theme_id').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Customer stamp cards — indexed from CardCreated / StampIssued / StampRedeemed events.
 * card_id is the SUI shared-object ID.
 */
export const cards = pgTable('cards', {
  cardId: text('card_id').primaryKey(),
  programId: text('program_id')
    .references(() => programs.programId)
    .notNull(),
  customerAddress: text('customer_address').notNull(),
  currentStamps: integer('current_stamps').default(0).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  lastStampedAt: timestamp('last_stamped_at'),
}, (table) => ({
  customerProgramIdx: index('cards_customer_program_idx')
    .on(table.customerAddress, table.programId),
}));

/**
 * Singleton cursor row for the event indexer.
 * Always one row with id = 1.
 */
export const indexerCursor = pgTable('indexer_cursor', {
  id: integer('id').primaryKey().default(1),
  lastEventSeq: text('last_event_seq'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const schema = { programs, cards, indexerCursor };
