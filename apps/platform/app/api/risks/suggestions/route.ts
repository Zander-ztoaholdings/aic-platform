import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, riskSignalDismissals } from '@aic/db';
import { orgCaller, guarded, notReady } from '@/lib/registers/caller';
import { nextReviewAt, score } from '@/lib/registers/risk';
import { LIBRARY_BY_KEY } from '@/lib/registers/risk-library';
import { deriveSignals, suggestedDescription } from '@/lib/registers/risk-signals';
import { observe, saveTracking, recordEvents, isNotMigrated } from '@/lib/registers/risk-observe';

export const dynamic = 'force-dynamic';

/**
 * Act on something AIC noticed.
 *   { action: 'add', libraryKey, signals: string[] }: add the suggested risk,
 *     its description carrying the evidence as AIC holds it now (re-read here,
 *     never taken from the request).
 *   { action: 'dismiss', signals: string[], reason }: do not suggest these
 *     again, and remember why.
 */
export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; libraryKey?: unknown; signals?: unknown; reason?: unknown };
  const ids = Array.isArray(b.signals) ? [...new Set(b.signals.filter((s): s is string => typeof s === 'string' && s.includes(':') && s.length <= 320))].slice(0, 20) : [];
  if (!ids.length) return NextResponse.json({ error: 'Say which of AIC\'s observations this is about.' }, { status: 400 });

  if (b.action === 'dismiss') {
    const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 1000) : '';
    if (reason.length < 5) return NextResponse.json({ error: 'Say why this does not belong on the register.' }, { status: 400 });
    try {
      await getTenantDb(c.orgId).query((tx) => tx.insert(riskSignalDismissals).values(ids.map((id) => {
        const at = id.indexOf(':');
        return { orgId: c.orgId, signalKey: id.slice(0, at).slice(0, 60), subject: id.slice(at + 1).slice(0, 255), reason, dismissedBy: c.userId };
      })).onConflictDoNothing());
    } catch (e) {
      if (isNotMigrated(e)) return notReady('018');
      throw e;
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action !== 'add') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const key = typeof b.libraryKey === 'string' ? b.libraryKey : '';
  const t = LIBRARY_BY_KEY[key];
  if (!t) return NextResponse.json({ error: 'AIC does not know that risk.' }, { status: 400 });
  return guarded('016', async () => {
    const now = new Date();
    const live = deriveSignals((await observe(c.orgId, now)).observations).filter((s) => ids.includes(s.id));
    if (!live.length) return NextResponse.json({ error: 'AIC no longer sees this. Refresh the page.' }, { status: 409 });
    const [row] = await getTenantDb(c.orgId).query((tx) => tx.insert(risks).values({
      orgId: c.orgId, title: t.title, description: suggestedDescription(key, live, now.toISOString()), category: t.category,
      likelihood: t.likelihood, impact: t.impact, treatment: t.treatment, treatmentPlan: t.treatmentPlan, controls: t.controls, status: 'open',
      reviewAt: nextReviewAt(score(t.likelihood, t.impact), now), createdBy: c.userId,
    }).returning({ id: risks.id }));
    await saveTracking(c.orgId, row.id, { source: 'signal', libraryKey: key, signalKeys: live.map((s) => s.id) });
    await recordEvents(c.orgId, c.userId, [
      { riskId: row.id, kind: 'created', detail: { title: t.title, likelihood: t.likelihood, impact: t.impact, score: score(t.likelihood, t.impact), source: 'signal', libraryKey: key } },
      { riskId: row.id, kind: 'signal', detail: { signals: live.map((s) => ({ id: s.id, title: s.title, evidence: s.evidence })) } },
    ]);
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}
