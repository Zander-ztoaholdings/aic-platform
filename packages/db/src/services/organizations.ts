import { organizations, eq, getTenantDb, getSystemDb } from '../db';
import { CertificationTier } from '@aic/types';

/**
 * INSTITUTIONAL ORGANIZATION SERVICE
 * 
 * Provides a type-safe facade for all organization-related database operations.
 * Enforces RLS and institutional business rules.
 */
export class OrganizationService {
  /**
   * Fetch an organization by ID (with RLS)
   */
  static async getById(orgId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      return org;
    });
  }

  /**
   * Update organization metadata
   */
  static async update(orgId: string, data: Partial<{ name: string; tier: CertificationTier; contactEmail: string }>) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [updated] = await tx
        .update(organizations)
        .set({ ...data })
        .where(eq(organizations.id, orgId))
        .returning();
      return updated;
    });
  }

  /**
   * System-level lookup (SuperAdmin only)
   */
  static async systemGetById(orgId: string) {
    const db = getSystemDb();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return org;
  }
}
