import { getSystemDb, decisionRecords, publicIndexRankings, eq, sql } from '../db';

export class IndexIntelligenceService {
  /**
   * Recalculates the accountability metrics for a Fortune 500 entity
   * based on linked production data (if they are a client).
   */
  static async refreshAccountabilityMetrics(orgId: string) {
    const db = getSystemDb();

    // 1. Fetch aggregate metrics (Institutional Privacy: aggregate only)
    const [metrics] = await db.select({
      total: sql<number>`count(*)`,
      overrides: sql<number>`count(*) filter (where is_human_override = true)`,
      policyHits: sql<number>`count(*) filter (where is_human_override = false)`
    })
    .from(decisionRecords)
    .where(eq(decisionRecords.orgId, orgId));

    if (!metrics || Number(metrics.total) === 0) return;

    const overrideRate = Math.round((Number(metrics.overrides) / Number(metrics.total)) * 100);
    const hitRate = Math.round((Number(metrics.policyHits) / Number(metrics.total)) * 100);

    // 2. Update the public index
    await db.update(publicIndexRankings)
      .set({ lastAssessedAt: new Date() })
      .where(eq(publicIndexRankings.linkedOrgId, orgId));
    
    return { overrideRate, hitRate };
  }

  /**
   * Calculates the overall Maturity Score for the Fortune 500 Index
   * Formula: Weighted average of 5 rights compliance + governance oversight
   */
  static async updateMaturityScore(companyId: string) {
    const db = getSystemDb();
    
    const [ranking] = await db.select()
        .from(publicIndexRankings)
        .where(eq(publicIndexRankings.id, companyId))
        .limit(1);

    if (!ranking) return;

    // Institutional Scoring Logic
    const score = Math.round(
        ((ranking.boardOversightScore ?? 0) * 0.3) +
        ((ranking.rightsComplianceScore ?? 0) * 0.4) +
        ((ranking.transparencyScore ?? 0) * 0.2) +
        ((ranking.riskManagementScore ?? 0) * 0.1)
    );

    await db.update(publicIndexRankings)
        .set({ maturityScore: score })
        .where(eq(publicIndexRankings.id, companyId));
    
    return score;
  }
}
