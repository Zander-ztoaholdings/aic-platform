import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
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
