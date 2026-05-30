import { auditRequirements, eq, asc, getTenantDb, getSystemDb } from '../db';

export class RequirementService {
  /**
   * List requirements for an organization
   */
  static async list(orgId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      return await tx
        .select()
        .from(auditRequirements)
        .where(eq(auditRequirements.orgId, orgId))
        .orderBy(asc(auditRequirements.createdAt));
    });
  }

  /**
   * Update a requirement (System/Auditor level)
   */
  static async systemUpdate(id: string, data: { status: string; findings?: string }) {
    const db = getSystemDb();
    const [updated] = await db
      .update(auditRequirements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(auditRequirements.id, id))
      .returning();
    return updated;
  }
}
