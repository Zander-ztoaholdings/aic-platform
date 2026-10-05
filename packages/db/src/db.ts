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

let tenantPool: Pool | null = null;
let tenantDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let warnedAboutFallback = false;

function poolOptions(connectionString: string | undefined) {
  return {
    connectionString,
    max: 50, // Institutional Capacity
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    maxUses: 7500, // Prevent memory leaks in long-running processes
  };
}

/**
 * The owning connection. Used by getSystemDb() for the work that is
 * legitimately cross-organisation — registration, auth callbacks, the public
 * register, admin tooling — and, until TENANT_DATABASE_URL is set, by the
 * tenant path as well.
 */
function getDbInstance() {
  if (!db) {
    pool = new Pool(poolOptions(process.env.DATABASE_URL || process.env.POSTGRES_URL));
    db = drizzle(pool, { schema });
  }
  return db;
}

/**
 * The restricted connection, for everything scoped to one organisation.
 *
 * WHY THIS IS SEPARATE.
 *
 * Postgres exempts a table's OWNER from `ENABLE ROW LEVEL SECURITY`. The
 * application has always connected with one DATABASE_URL, and that role owns
 * the schema, so every isolation policy in this database has been inert in
 * production — set_config('app.current_org_id', ...) was being set on a
 * connection that no policy was ever consulted for. db/manual/004 records the
 * same finding, verified against a live database.
 *
 * FORCE ROW LEVEL SECURITY is not the fix, because it would apply to the owner
 * too, and the owner is what getSystemDb() legitimately uses to read across
 * organisations — registration would fail on its first INSERT. The fix is a
 * second role that owns nothing, so the policies apply to it normally.
 *
 * Until TENANT_DATABASE_URL is provisioned (see db/manual/008_tenant_isolation.sql
 * and SECURITY-RLS-RUNBOOK.md) this returns the owning connection and says so,
 * once, loudly. That is the status quo rather than a regression — but it is a
 * status quo worth being told about on every boot, because "we have row-level
 * security" is a claim this organisation may end up making to an assessor.
 */
function getTenantDbInstance() {
  const url = process.env.TENANT_DATABASE_URL;

  if (!url) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn(
        '[SECURITY] TENANT_DATABASE_URL is not set. Tenant queries are running on the ' +
        'owning database role, which Postgres exempts from row-level security, so the ' +
        'isolation policies are not being enforced. Tenant separation currently rests ' +
        'entirely on the org_id filters in application queries. See SECURITY-RLS-RUNBOOK.md.'
      );
    }
    return getDbInstance();
  }

  if (!tenantDb) {
    tenantPool = new Pool(poolOptions(url));
    tenantDb = drizzle(tenantPool, { schema });
  }
  return tenantDb;
}

/**
 * Whether tenant isolation is actually being enforced right now, for a health
 * endpoint or a boot log. Reported rather than assumed: the difference between
 * a policy existing and a policy applying is invisible from the application
 * unless something goes looking.
 */
export function getTenantIsolationStatus() {
  return {
    enforced: !!process.env.TENANT_DATABASE_URL,
    detail: process.env.TENANT_DATABASE_URL
      ? 'Tenant queries use a non-owning role; row-level security applies.'
      : 'Tenant queries use the owning role, which bypasses row-level security.',
  };
}

/**
 * The same question, answered by trying it: signs in as the tenant role and
 * asks Postgres who it is and whether that role can bypass row-level security.
 * The variable being set is not proof; on 5 October 2026 it was set with a
 * password the database did not accept, health said "enforced", and every
 * client page failed. This is what /api/health reports now.
 */
export async function probeTenantIsolation(): Promise<{ enforced: boolean; detail: string }> {
  if (!process.env.TENANT_DATABASE_URL) {
    return { enforced: false, detail: 'not enforced: set TENANT_DATABASE_URL' };
  }
  getTenantDbInstance();
  try {
    const r = await tenantPool!.query(
      `SELECT current_user AS u, (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`
    );
    const row = r.rows[0] as { u: string; bypass: boolean };
    if (row.bypass) return { enforced: false, detail: `not enforced: ${row.u} can bypass row-level security` };
    return { enforced: true, detail: `enforced (signed in as ${row.u})` };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { enforced: false, detail: `tenant role cannot sign in: ${err.code ?? ''} ${err.message ?? 'unknown error'}`.trim() };
  }
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

  const rawDb = getTenantDbInstance();

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
export { sql, eq, and, or, desc, asc, like, gte, lt, avg, count, sum, min, max, isNull, isNotNull, ne, inArray, lte, gt } from 'drizzle-orm';
