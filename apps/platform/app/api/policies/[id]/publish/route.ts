import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPolicies, policyVersions, hitlLogs, eq, and } from '@aic/db';
import { policyCaller, bodyHash } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';

/**
 * Publish the working copy as the next version. The text is frozen with its
 * hash, and everyone is asked to accept again: acceptance of version 2 says
 * nothing about version 3.
 */
export async function POST(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const result = await getTenantDb(c.orgId).query(async (tx) => {
    const [p] = await tx.select().from(orgPolicies).where(and(eq(orgPolicies.id, id), eq(orgPolicies.orgId, c.orgId))).limit(1);
    if (!p) return { error: 'Not found', status: 404 } as const;
    if (/\[[^\]]{2,60}\]/.test(p.body)) {
      return { error: 'Fill in the parts in square brackets before publishing, so the policy says who does what.', status: 400 } as const;
    }
    const version = p.publishedVersion + 1;
    await tx.insert(policyVersions).values({ orgId: c.orgId, policyId: p.id, version, title: p.title, body: p.body, bodyHash: bodyHash(p.title, p.body), publishedBy: c.userId });
    await tx.update(orgPolicies).set({ publishedVersion: version, updatedAt: new Date() }).where(eq(orgPolicies.id, p.id));
    await tx.insert(hitlLogs).values({
      orgId: c.orgId, actorId: c.userId, targetType: 'POLICY', targetId: p.id,
      previousValue: { version: p.publishedVersion }, newValue: { version, title: p.title }, overrideReason: `Published ${p.title} version ${version}`,
    });
    return { version } as const;
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
