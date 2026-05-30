import { organizations, auditRequirements, incidents, eq, sql, getTenantDb, TenantTransaction } from '../db';

export interface IntelligenceStats {
  score: number;
  openIncidents: number;
  totalRequirements: number;
  verifiedRequirements: number;
}

/**
 * INSTITUTIONAL BUSINESS LOGIC: Integrity Scoring
 * 
 * Calculates the weighted integrity score for an organization.
 * This logic is decoupled from the API layer to ensure it can be
 * called by the Engine, the Platform, or CLI tools with zero drift.
 */
export async function calculateOrganizationIntelligence(orgId: string): Promise<IntelligenceStats> {
  const tdb = getTenantDb(orgId);
  return await tdb.query(async (tx: TenantTransaction) => {
    // 1. Fetch requirements (RLS will automatically filter by orgId)
    const requirements = await tx.select().from(auditRequirements);
    type AuditRequirement = typeof auditRequirements.$inferSelect;
    
    const categories: Record<string, { weight: number; score: number; total: number }> = {
      'DOCUMENTATION': { weight: 0.20, score: 0, total: 0 },
      'OVERSIGHT': { weight: 0.35, score: 0, total: 0 },
      'REPORTS': { weight: 0.25, score: 0, total: 0 },
      'TECHNICAL': { weight: 0.20, score: 0, total: 0 }
    };

    requirements.forEach((req: AuditRequirement) => {
      const catKey = req.category?.toUpperCase() || '';
      const cat = categories[catKey];
      if (cat) {
        cat.total++;
        if (req.status === 'VERIFIED') cat.score++;
      }
    });

    let calculatedScore = 0;
    Object.values(categories).forEach(cat => {
      if (cat.total > 0) {
        calculatedScore += (cat.score / cat.total) * cat.weight * 100;
      }
    });

    // 2. Fetch Open Incidents (RLS filtered)
    const openIncidentsResult = await tx
      .select({ count: sql<number>`count(*)` })
      .from(incidents)
      .where(eq(incidents.status, 'OPEN'));
    
    const openIncidents = Number(openIncidentsResult[0]?.count || 0);
    const penalty = openIncidents * 5;

    const finalScore = Math.max(0, Math.round(calculatedScore) - penalty);

    // 3. Persist score to organization table (Atomic update)
    await tx
      .update(organizations)
      .set({ integrityScore: finalScore })
      .where(eq(organizations.id, orgId));

    return {
      score: finalScore,
      openIncidents,
      totalRequirements: requirements.length,
      verifiedRequirements: requirements.filter((r: AuditRequirement) => r.status === 'VERIFIED').length
    };
  });
}
