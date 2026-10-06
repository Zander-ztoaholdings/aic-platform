import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, and, eq } from '@aic/db';
import { orgCaller, guarded, notReady } from '@/lib/registers/caller';
import { validateRisk, validateAcceptance, nextReviewAt, score, STATUSES, TREATMENTS } from '@/lib/registers/risk';
import { buildRegister } from '@/lib/registers/risk-register';
import { saveTracking, recordEvents, loadTracking } from '@/lib/registers/risk-observe';
import { RISK_LIBRARY, LIBRARY_BY_KEY } from '@/lib/registers/risk-library';
import { COMMON_CONTROLS } from '@/lib/common-controls';

export const dynamic = 'force-dynamic';
const KNOWN = new Set(COMMON_CONTROLS.map((c) => c.key));

export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('016', async () => {
    const reg = await buildRegister(c.orgId);
    const open = reg.risks.filter((r) => r.status !== 'closed');
    const onRegister = new Set(reg.risks.filter((r) => r.status !== 'closed' && r.libraryKey).map((r) => r.libraryKey as string));
    return NextResponse.json({
      risks: reg.risks,
      heatmap: reg.heatmap.inherent,
      heatmaps: reg.heatmap,
      suggestions: reg.suggestions,
      dismissed: reg.dismissed,
      live: reg.live,
      counts: {
        byStatus: Object.fromEntries(STATUSES.map((s) => [s, reg.risks.filter((r) => r.status === s).length])),
        byTreatment: Object.fromEntries(TREATMENTS.map((t) => [t, open.filter((r) => r.treatment === t).length])),
        overdue: open.filter((r) => r.overdue).length,
        unowned: open.filter((r) => !r.ownerName).length,
        worse: open.filter((r) => r.live.trend === 'worse').length,
        acceptanceExpired: open.filter((r) => r.acceptanceExpired).length,
      },
      library: RISK_LIBRARY.map((t) => ({ ...t, onRegister: onRegister.has(t.key) })),
      canManage: c.canManage,
      controls: COMMON_CONTROLS.map(({ key, title, area }) => ({ key, title, area })),
    });
  });
}

export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validateRisk(body, KNOWN);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const libraryKey = typeof body?.libraryKey === 'string' && LIBRARY_BY_KEY[body.libraryKey] ? body.libraryKey : null;
  let acceptance = null;
  if (v.value.treatment === 'accept') {
    const a = validateAcceptance(body);
    if ('error' in a) return NextResponse.json({ error: a.error }, { status: 400 });
    acceptance = a.value;
  }
  if (v.value.status === 'accepted' && v.value.treatment !== 'accept') return NextResponse.json({ error: 'To mark a risk accepted, choose "Accept it" as what you will do about it.' }, { status: 400 });
  return guarded('016', async () => {
    // An acceptance needs somewhere to keep who approved it, why and until when.
    if (acceptance && (await loadTracking(c.orgId)) === null) return notReady('018');
    const reviewAt = v.value.reviewAt ?? nextReviewAt(score(v.value.likelihood, v.value.impact));
    const [row] = await getTenantDb(c.orgId).query((tx) => tx.insert(risks).values({ orgId: c.orgId, ...v.value, reviewAt, createdBy: c.userId }).returning({ id: risks.id }));
    const saved = await saveTracking(c.orgId, row.id, { source: libraryKey ? 'library' : 'manual', libraryKey, ...(acceptance ?? {}) });
    if (acceptance && !saved) {
      await getTenantDb(c.orgId).query((tx) => tx.delete(risks).where(and(eq(risks.id, row.id), eq(risks.orgId, c.orgId))));
      return notReady('018');
    }
    await recordEvents(c.orgId, c.userId, [{ riskId: row.id, kind: 'created', detail: { title: v.value.title, likelihood: v.value.likelihood, impact: v.value.impact, score: score(v.value.likelihood, v.value.impact), source: libraryKey ? 'library' : 'manual', libraryKey, ...(acceptance ?? {}) } }]);
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}
