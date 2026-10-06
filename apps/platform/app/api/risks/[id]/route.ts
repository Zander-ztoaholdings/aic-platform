import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, risks, users, and, eq, inArray } from '@aic/db';
import { orgCaller, guarded, notReady } from '@/lib/registers/caller';
import { validateRisk, validateAcceptance, changeEvents, type RiskInput, type Acceptance } from '@/lib/registers/risk';
import { loadTracking, saveTracking, recordEvents, loadEvents } from '@/lib/registers/risk-observe';
import { COMMON_CONTROLS } from '@/lib/common-controls';
import { isUuid } from '@/lib/policy-hash';

type Ctx = { params: Promise<{ id: string }> };
const KNOWN = new Set(COMMON_CONTROLS.map((c) => c.key));

/** The risk's history, newest first. Empty before migration 018. */
export async function GET(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('016', async () => {
    const events = await loadEvents(c.orgId, id);
    const actorIds = [...new Set((events ?? []).map((e) => e.actorId).filter((x): x is string => !!x))];
    const names = actorIds.length
      ? await getTenantDb(c.orgId).query((tx) => tx.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.orgId, c.orgId), inArray(users.id, actorIds)))).catch(() => [])
      : [];
    const nameOf = new Map(names.map((n) => [n.id, n.name]));
    return NextResponse.json({
      live: events !== null,
      events: (events ?? []).map((e) => ({ id: e.id, kind: e.kind, detail: e.detail, actor: e.actorId ? nameOf.get(e.actorId) ?? null : null, createdAt: e.createdAt })),
    });
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validateRisk(body, KNOWN);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  let acceptance: Acceptance | null = null;
  if (v.value.treatment === 'accept') {
    const a = validateAcceptance(body);
    if ('error' in a) return NextResponse.json({ error: a.error }, { status: 400 });
    acceptance = a.value;
  }
  if (v.value.status === 'accepted' && v.value.treatment !== 'accept') return NextResponse.json({ error: 'To mark a risk accepted, choose "Accept it" as what you will do about it.' }, { status: 400 });
  return guarded('016', async () => {
    const db = getTenantDb(c.orgId);
    const [before] = await db.query((tx) => tx.select().from(risks).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))).limit(1));
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const tracking = await loadTracking(c.orgId);
    if (acceptance && tracking === null) return notReady('018');
    const t = tracking?.get(id);
    const prevAcceptance = t?.acceptedBy && t.acceptReason && t.acceptUntil ? { acceptedBy: t.acceptedBy, acceptReason: t.acceptReason, acceptUntil: t.acceptUntil } : null;

    await db.query((tx) => tx.update(risks).set({ ...v.value, updatedAt: new Date() }).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))));
    if (tracking) {
      await saveTracking(c.orgId, id, acceptance ?? (v.value.treatment !== 'accept' && prevAcceptance ? { acceptedBy: null, acceptReason: null, acceptUntil: null } : {}));
    }
    const prev: RiskInput = {
      title: before.title, description: before.description, category: before.category, likelihood: before.likelihood, impact: before.impact,
      residualLikelihood: before.residualLikelihood, residualImpact: before.residualImpact, treatment: before.treatment, treatmentPlan: before.treatmentPlan,
      controls: before.controls ?? [], ownerName: before.ownerName, status: before.status, reviewAt: before.reviewAt,
    };
    const events = changeEvents(prev, v.value, { before: prevAcceptance, after: acceptance });
    await recordEvents(c.orgId, c.userId, events.map((e) => ({ ...e, riskId: id })));
    return NextResponse.json({ ok: true });
  });
}

/** Admins only: remove a risk entered by mistake. A risk that no longer applies is closed instead, so its history stays. */
export async function DELETE(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ admin: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('016', async () => {
    const r = await getTenantDb(c.orgId).query((tx) => tx.delete(risks).where(and(eq(risks.id, id), eq(risks.orgId, c.orgId))).returning({ id: risks.id }));
    return r.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  });
}
