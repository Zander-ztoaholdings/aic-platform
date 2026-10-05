import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, customFrameworks, customFrameworkRequirements, eq, sql } from '@aic/db';
import { validateCustom } from '@/lib/frameworks/custom';
import { customKey } from '@/lib/frameworks/catalog';
import { frameworksCaller, NOT_READY, isMissingTable } from '@/lib/frameworks/caller';

const MAX_PER_ORG = 25;

/** Add one of the organisation's own frameworks. */
export async function POST(request: NextRequest) {
  const c = await frameworksCaller({ manage: true });
  if ('error' in c) return c.error;
  const v = validateCustom(await request.json().catch(() => null));
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const id = await getTenantDb(c.orgId).query(async (tx) => {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(customFrameworks).where(eq(customFrameworks.orgId, c.orgId));
      if (n >= MAX_PER_ORG) return null;
      const [f] = await tx.insert(customFrameworks).values({ orgId: c.orgId, name: v.value.name, description: v.value.description, createdBy: c.userId }).returning({ id: customFrameworks.id });
      await tx.insert(customFrameworkRequirements).values(v.value.requirements.map((r, i) => ({
        frameworkId: f.id, orgId: c.orgId, position: i + 1, ref: r.id, title: r.title, controls: r.controls,
      })));
      return f.id;
    });
    if (!id) return NextResponse.json({ error: `An organisation can have at most ${MAX_PER_ORG} of its own frameworks.` }, { status: 409 });
    return NextResponse.json({ id, key: customKey(id) }, { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NOT_READY();
    throw e;
  }
}
