import { config } from 'dotenv';
config({ path: '.env.local' });
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit CLI configuration.
 *
 * - `schema` points to the Drizzle table definitions.
 * - `out` is the directory where generated SQL migration files are stored.
 * - Uses DATABASE_URL_UNPOOLED (direct connection) for DDL operations.
 * - Locally: postgres://neon:npg@localhost:5432/neondb?sslmode=no-verify (Neon Local)
 * - Cloud: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require (direct URL)
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
});
