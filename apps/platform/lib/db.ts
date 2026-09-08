import { Pool } from 'pg';

// This previously read POSTGRES_URL plus separate POSTGRES_USER/PASSWORD/HOST/
// PORT/DB fields, none of which match DATABASE_URL -- the variable this
// deployment (and every other DB client in this repo: packages/db/src/db.ts,
// drizzle.config.ts) actually uses. Because the config object below always
// carried the individual keys (even as `undefined`), `pg` merged them over a
// parsed DATABASE_URL and silently dropped the real credentials, so every
// query on this pool failed -- caught by callers' generic try/catch and
// surfaced as a plain 500. Fixed 8 Sep 2026: prefer DATABASE_URL, matching the
// rest of the codebase; fall back to POSTGRES_URL, then to the discrete
// fields only when no connection string is present at all.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB,
    });

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Never log query text or params — they may contain PII (emails, hashes, etc.)
    console.log('executed query', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    // Log error type only, not the full query or params
    console.error('Database query failed:', (error as Error).message);
    throw error;
  }
};
