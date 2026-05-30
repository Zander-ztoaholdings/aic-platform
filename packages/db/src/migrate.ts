import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const runMigration = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('[DB] Running migrations...');

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, '../../../../db/migrations'),
    });
    console.log('[DB] Migrations completed successfully.');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
