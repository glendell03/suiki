import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Load env from .env.local in local runs; Vercel injects vars in CI.
import 'dotenv/config';

/**
 * Programmatic migration runner for CI/CD.
 *
 * Uses DATABASE_URL_UNPOOLED (direct connection) because migrations
 * require DDL statements that cannot run through a connection pooler.
 *
 * Usage: `pnpm db:migrate` (which runs `tsx src/lib/db/migrate.ts`)
 */
const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
const db = drizzle(sql);

const main = async () => {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

main();
