import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, agents, agentRuns, eq, ne, and, desc } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { cleanAgent, slugify, TOOLS_NOTICE, DEFAULT_LIMITS } from '@/lib/agents/config';
import { publicAgent, agentChoices, linksBelong, consentedTenants, pinTenants } from '@/lib/agents/view';

export const dynamic = 'force-dynamic';

/** The organisation's agents, with the latest run of each. Optional tooling; see TOOLS_NOTICE. */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return guarded('017', async () => {
    const db = getTenantDb(c.orgId);
    const rows = await db.query((tx) => tx.select().from(agents).where(and(eq(agents.orgId, c.orgId), ne(agents.status, 'archived'))).orderBy(agents.name));
    const runs = await db.query((tx) => tx.select({ agentId: agentRuns.agentId, id: agentRuns.id, status: agentRuns.status, startedAt: agentRuns.startedAt })
      .from(agentRuns).where(eq(agentRuns.orgId, c.orgId)).orderBy(desc(agentRuns.startedAt)).limit(500));
    const choices = await agentChoices(c.orgId);
    return NextResponse.json({
      notice: TOOLS_NOTICE, canManage: c.canManage, ...choices,
      agents: rows.map((a) => {
        const mine = runs.filter((r) => r.agentId === a.id);
        return { ...publicAgent(a), lastRun: mine[0] ?? null, waiting: mine.filter((r) => r.status === 'waiting_for_person').length };
      }),
    });
  });
}

export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = cleanAgent({ instructions: '', tools: [{ kind: 'ask_a_person' }], limits: DEFAULT_LIMITS, ownerUserId: c.userId, ...body });
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  return guarded('017', async () => {
    const bad = await linksBelong(c.orgId, v.value.ownerUserId, v.value.aiSystemId);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    v.value.tools = pinTenants(v.value.tools, await consentedTenants(c.orgId));
    const db = getTenantDb(c.orgId);
    const taken = new Set((await db.query((tx) => tx.select({ slug: agents.slug }).from(agents).where(eq(agents.orgId, c.orgId)))).map((r) => r.slug));
    const base = slugify(v.value.name);
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    const [row] = await db.query((tx) => tx.insert(agents).values({ orgId: c.orgId, slug, ...v.value, status: 'draft', createdBy: c.userId }).returning({ id: agents.id }));
    return NextResponse.json({ id: row.id }, { status: 201 });
  });
}
