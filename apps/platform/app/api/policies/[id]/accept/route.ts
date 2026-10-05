import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPolicies, policyAcceptances, eq, and } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';

/** The signed-in person accepts the current published version. Idempotent. */
export async function POST(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const result = await getTenantDb(c.orgId).query(async (tx) => {
    const [p] = await tx.select({ id: orgPolicies.id, v: orgPolicies.publishedVersion }).from(orgPolicies).where(and(eq(orgPolicies.id, id), eq(orgPolicies.orgId, c.orgId))).limit(1);
    if (!p) return { error: 'Not found', status: 404 } as const;
    if (p.v === 0) return { error: 'This policy has not been published yet.', status: 400 } as const;
    await tx.insert(policyAcceptances).values({ orgId: c.orgId, policyId: p.id, version: p.v, userId: c.userId }).onConflictDoNothing();
    return { version: p.v } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
