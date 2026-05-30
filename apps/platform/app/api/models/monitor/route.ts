import { NextResponse } from 'next/server';
import { getTenantDb, models, decisionRecords, notifications, organizations, eq, and, desc } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import { NotificationService } from '@aic/notifications';
import type { Session } from 'next-auth';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

export async function POST() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      // 1. Fetch organization details for context
      const [org] = await tx
          .select({ name: organizations.name, contactEmail: organizations.contactEmail })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);

      // 2. Fetch registered models for this org
      const registeredModels = await tx
          .select()
          .from(models)
          .where(and(eq(models.orgId, orgId), eq(models.isActive, true)));

      const results = [];

      for (const model of registeredModels) {
          // 3. Fetch latest decisions for this model to analyze drift
          const recentDecisions = await tx
              .select({ inputParams: decisionRecords.inputParams, outcome: decisionRecords.outcome })
              .from(decisionRecords)
              .where(and(eq(decisionRecords.orgId, orgId), eq(decisionRecords.systemName, model.name)))
              .orderBy(desc(decisionRecords.createdAt))
              .limit(100);

          if (recentDecisions.length < 50) {
              results.push({ model: model.name, status: 'SKIPPED', reason: 'Insufficient data for drift analysis' });
              continue;
          }

          // 4. Prepare data for Engine
          const rows = recentDecisions.map(d => ({
              ...(d.inputParams as Record<string, unknown>),
              outcome: (d.outcome as Record<string, unknown>).result === 'APPROVED' ? 1 : 0
          }));

          // 5. Call Engine for Drift/Bias Analysis
          try {
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (ENGINE_API_KEY) headers['X-API-Key'] = ENGINE_API_KEY;

              const engineRes = await fetch(`${ENGINE_URL}/api/v1/analyze/statistical`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                      protected_attribute: (model.metadata as Record<string, unknown>)?.protected_attribute || 'group',
                      outcome_variable: 'outcome',
                      data: rows
                  })
              });

              if (engineRes.ok) {
                  const analysis = await engineRes.json();
                  
                  // 6. Alert if bias is significant (Task M35: Email Integration)
                  if (analysis.is_significant) {
                      await tx.insert(notifications).values({
                          orgId,
                          title: 'AUTOMATED DRIFT ALERT',
                          message: `Model "${model.name}" has drifted beyond acceptable fairness bounds. Statistical significance: ${analysis.p_value}.`,
                          type: 'ALERT'
                      });

                      if (org?.contactEmail) {
                          await NotificationService.notifyBiasAlert(org.contactEmail, org.name, model.name);
                      }
                  }

                  results.push({ model: model.name, status: 'SUCCESS', analysis });
              }
          } catch (engineErr) {
              console.error(`Engine Error for model ${model.name}:`, engineErr);
              results.push({ model: model.name, status: 'ERROR', detail: 'Audit engine unreachable' });
          }
      }

      return NextResponse.json({ success: true, monitoring_results: results });
    });

  } catch (error) {
    console.error('[SECURITY] Monitoring Job Error:', error);
    return NextResponse.json({ error: 'Failed to execute monitoring' }, { status: 500 });
  }
}
