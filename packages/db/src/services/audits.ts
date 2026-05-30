import { auditLogs, eq, desc, getTenantDb, sql } from '../db';

export class AuditLogService {
  static async list(orgId: string, limit = 25, offset = 0) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const logs = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.orgId, orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
      
      const [count] = await tx.select({ count: sql<number>`count(*)` }).from(auditLogs).where(eq(auditLogs.orgId, orgId));
      
      return { logs, total: Number(count.count) };
    });
  }

  static async getById(orgId: string, logId: string) {
    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      const [log] = await tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, logId))
        .limit(1);
      return log;
    });
  }
}
