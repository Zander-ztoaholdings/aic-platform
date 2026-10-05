import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPolicies, policyVersions, policyAcceptances, users, eq, and, desc } from '@aic/db';
import { policyCaller, orgMembers } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';
import { TEMPLATE_BY_KEY } from '@/lib/policy-templates';

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const db = getTenantDb(c.orgId);
  const data = await db.query(async (tx) => {
    const [p] = await tx.select().from(orgPolicies).where(and(eq(orgPolicies.id, id), eq(orgPolicies.orgId, c.orgId))).limit(1);
    if (!p) return null;
    const versions = await tx.select({ version: policyVersions.version, title: policyVersions.title, body: policyVersions.body, bodyHash: policyVersions.bodyHash, publishedAt: policyVersions.publishedAt, publishedBy: users.name })
      .from(policyVersions).leftJoin(users, eq(users.id, policyVersions.publishedBy))
      .where(eq(policyVersions.policyId, id)).orderBy(desc(policyVersions.version));
    const acceptances = await tx.select({ userId: policyAcceptances.userId, version: policyAcceptances.version, acceptedAt: policyAcceptances.acceptedAt })
      .from(policyAcceptances).where(eq(policyAcceptances.policyId, id));
    return { p, versions, acceptances };
  });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const members = await orgMembers(c.orgId);
  const current = data.versions.find((v) => v.version === data.p.publishedVersion) ?? null;
  return NextResponse.json({
    canManage: c.canManage,
    policy: {
      id: data.p.id, title: data.p.title, body: data.p.body, templateKey: data.p.templateKey,
      publishedVersion: data.p.publishedVersion, reviewDueAt: data.p.reviewDueAt, updatedAt: data.p.updatedAt,
      controls: data.p.templateKey ? TEMPLATE_BY_KEY[data.p.templateKey]?.controls ?? [] : [],
      hasUnpublishedChanges: !current || current.title !== data.p.title || current.body !== data.p.body,
    },
    current,
    versions: data.versions.map(({ body: _b, ...v }) => v),
    members: members.map((m) => {
      const a = data.acceptances.find((x) => x.userId === m.id && x.version === data.p.publishedVersion);
      return { id: m.id, name: m.name, acceptedAt: a?.acceptedAt ?? null, isMe: m.id === c.userId };
    }),
  });
}

/** Edit the working copy. Publishing it is a separate, deliberate step. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { title?: string; body?: string; reviewDueAt?: string | null };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof b.title === 'string') {
    if (!b.title.trim() || b.title.length > 255) return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
    set.title = b.title.trim();
  }
  if (typeof b.body === 'string') {
    if (b.body.length > 100_000) return NextResponse.json({ error: 'That policy is too long.' }, { status: 400 });
    set.body = b.body;
  }
  if (b.reviewDueAt !== undefined) set.reviewDueAt = b.reviewDueAt ? new Date(b.reviewDueAt) : null;
  const updated = await getTenantDb(c.orgId).query((tx) =>
    tx.update(orgPolicies).set(set).where(and(eq(orgPolicies.id, id), eq(orgPolicies.orgId, c.orgId))).returning({ id: orgPolicies.id })
  );
  if (updated.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
