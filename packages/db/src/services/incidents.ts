import { incidents, eq, desc, getTenantDb, sql } from '../db';
import { IncidentStatus } from '@aic/types';

export class IncidentService {
  /**
   * List incidents for an organization
   */
  static async list(orgId: string, limit = 25, offset = 0) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const results = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.orgId, orgId))
        .orderBy(desc(incidents.createdAt))
        .limit(limit)
        .offset(offset);
      
      const [count] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(incidents)
        .where(eq(incidents.orgId, orgId));

      return { incidents: results, total: Number(count.count) };
    });
  }

  /**
   * Get incident by ID
   */
  static async getById(orgId: string, incidentId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [incident] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);
      return incident;
    });
  }

  /**
   * Update incident status/resolution
   */
  static async update(orgId: string, incidentId: string, data: { status?: IncidentStatus; resolutionDetails?: string; humanReviewerId?: string }) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [updated] = await tx
        .update(incidents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(incidents.id, incidentId))
        .returning();
      return updated;
    });
  }
}
