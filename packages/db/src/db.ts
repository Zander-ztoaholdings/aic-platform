import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';
import { sql, SQL, ExtractTablesWithRelations } from 'drizzle-orm';
import { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export type TenantTransaction = PgTransaction<
  PgQueryResultHKT, 
  typeof schema, 
  ExtractTablesWithRelations<typeof schema>
>;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDbInstance() {
  if (!db) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      max: 50, // Institutional Capacity
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      maxUses: 7500, // Prevent memory leaks in long-running processes
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

/**
 * SOVEREIGN TENANT ISOLATION (ZERO-BYPASS)
 * 
 * Returns a database instance scoped to a specific organization.
 * All operations must be performed within the query/transaction callback 
 * to ensure the RLS 'app.current_org_id' variable is set.
 */
export function getTenantDb(orgId: string) {
  if (!orgId) throw new Error("[SECURITY] Attempted to access tenant DB without an orgId");

  const rawDb = getDbInstance();

  return {
    /**
     * Executes a callback within a transaction scoped to the current tenant.
     * This is the PRIMARY way to interact with the tenant database.
     */
    query: async <T>(callback: (tx: TenantTransaction) => Promise<T>): Promise<T> => {
      return await rawDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
        return await callback(tx);
      });
    },

    /**
     * Legacy/Compatibility: Executes raw queries with tenant context.
     */
    execute: async (query: SQL<unknown>): Promise<unknown> => {
      return await rawDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
        return await tx.execute(query);
      });
    },

    /**
     * Transaction wrapper (same as query, but named consistently with Drizzle).
     */
    transaction: async <T>(callback: (tx: TenantTransaction) => Promise<T>): Promise<T> => {
      return await rawDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
        return await callback(tx);
      });
    }
  };
}

/**
 * SYSTEM ACCESS (RESTRICTED)
 * 
 * Used for internal administrative tasks (Auth, Organization setup, Global Ledger).
 * Should ONLY be used in /apps/internal or auth callbacks.
 */
export function getSystemDb() {
  return getDbInstance();
}

export * from './schema';
export { schema }; 
export type { PgTransaction, PgQueryResultHKT };
export { pool }; // Note: This will be null until first DB access
export { sql, eq, and, or, desc, asc, like, gte, lt, avg, count, sum, min, max, isNull, isNotNull } from 'drizzle-orm';
