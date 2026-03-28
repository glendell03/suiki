import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Neon serverless DB client singleton.
 *
 * Uses DATABASE_URL (pooled for Vercel, or localhost for Neon Local dev).
 * Validated by src/env.ts -- will throw at startup if missing.
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export type Db = typeof db;
