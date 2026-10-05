import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgTraining, trainingCompletions, users, eq, desc } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { MODULES, MODULE_BY_KEY, DEFAULT_REQUIRED, isCurrent } from '@/lib/training/modules';

export const dynamic = 'force-dynamic';

/**
 * Training: the modules, which ones the organisation requires and how often,
 * where the signed-in person stands, and (for those who manage compliance)
 * where everyone stands.
 */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('016', async () => {
    const { settings, done, members } = await getTenantDb(c.orgId).query(async (tx) => ({
      settings: await tx.select().from(orgTraining).where(eq(orgTraining.orgId, c.orgId)),
      done: await tx.select().from(trainingCompletions).where(eq(trainingCompletions.orgId, c.orgId)).orderBy(desc(trainingCompletions.completedAt)),
      members: await tx.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, active: users.isActive }).from(users).where(eq(users.orgId, c.orgId)),
    }));
    const chosen = settings.length > 0;
    const requirement = MODULES.map((m) => {
      const s = settings.find((x) => x.moduleKey === m.key);
      return { key: m.key, required: s ? s.required : DEFAULT_REQUIRED.includes(m.key), everyMonths: s?.everyMonths ?? 12 };
    });
    const people = members.filter((m) => m.active !== false && !m.email.endsWith('@removed.invalid'));
    const state = (userId: string, key: string) => {
      const r = requirement.find((x) => x.key === key)!;
      const last = done.find((d) => d.userId === userId && d.moduleKey === key) ?? null;
      return { completedAt: last?.completedAt ?? null, score: last?.score ?? null, current: !!last && isCurrent(last.completedAt, r.everyMonths) };
    };
    return NextResponse.json({
      modules: MODULES.map(({ key, title, summary, minutes, audience, version }) => ({ key, title, summary, minutes, audience, version })),
      requirement, chosen,
      mine: Object.fromEntries(MODULES.map((m) => [m.key, state(c.userId, m.key)])),
      team: c.canManage ? people.map((p) => ({ id: p.id, name: p.name, jobTitle: p.jobTitle, modules: Object.fromEntries(MODULES.map((m) => [m.key, state(p.id, m.key)])) })) : null,
      canManage: c.canManage, isAdmin: c.isAdmin,
    });
  });
}

/** Admins: which modules are required, and how often. */
export async function PUT(request: NextRequest) {
  const c = await orgCaller({ admin: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { requirement?: unknown };
  if (!Array.isArray(b.requirement)) return NextResponse.json({ error: 'Send the requirement list.' }, { status: 400 });
  const rows = (b.requirement as { key?: unknown; required?: unknown; everyMonths?: unknown }[])
    .filter((r) => typeof r.key === 'string' && MODULE_BY_KEY[r.key as string])
    .map((r) => ({ orgId: c.orgId, moduleKey: r.key as string, required: r.required === true, everyMonths: [6, 12, 24].includes(Number(r.everyMonths)) ? Number(r.everyMonths) : 12, updatedBy: c.userId }));
  return guarded('016', async () => {
    await getTenantDb(c.orgId).query(async (tx) => {
      await tx.delete(orgTraining).where(eq(orgTraining.orgId, c.orgId));
      if (rows.length) await tx.insert(orgTraining).values(rows);
    });
    return NextResponse.json({ ok: true });
  });
}
