import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPolicies, policyAcceptances, eq, asc } from '@aic/db';
import { policyCaller, orgMembers } from '@/lib/policies';
import { POLICY_TEMPLATES, TEMPLATE_BY_KEY } from '@/lib/policy-templates';

/** The organisation's policies, how many members accepted the current version, and templates not yet adopted. */
export async function GET() {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const db = getTenantDb(c.orgId);
  const [policies, acceptances] = await db.query(async (tx) => [
    await tx.select().from(orgPolicies).where(eq(orgPolicies.orgId, c.orgId)).orderBy(asc(orgPolicies.createdAt)),
    await tx.select().from(policyAcceptances).where(eq(policyAcceptances.orgId, c.orgId)),
  ] as const);
  const members = await orgMembers(c.orgId);
  const adopted = new Set(policies.map((p) => p.templateKey).filter(Boolean));
  return NextResponse.json({
    canManage: c.canManage,
    members: members.length,
    policies: policies.map((p) => {
      const current = acceptances.filter((a) => a.policyId === p.id && a.version === p.publishedVersion && p.publishedVersion > 0);
      return {
        id: p.id, title: p.title, templateKey: p.templateKey, publishedVersion: p.publishedVersion,
        reviewDueAt: p.reviewDueAt, updatedAt: p.updatedAt,
        accepted: current.length, acceptedByMe: current.some((a) => a.userId === c.userId),
        controls: p.templateKey ? TEMPLATE_BY_KEY[p.templateKey]?.controls ?? [] : [],
      };
    }),
    templates: POLICY_TEMPLATES.filter((t) => !adopted.has(t.key)).map(({ key, title, summary, controls }) => ({ key, title, summary, controls })),
  });
}

/** Adopt a template (or start a blank policy) as a draft. */
export async function POST(request: NextRequest) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const body = (await request.json().catch(() => ({}))) as { templateKey?: string; title?: string };
  const t = body.templateKey ? TEMPLATE_BY_KEY[body.templateKey] : null;
  if (body.templateKey && !t) return NextResponse.json({ error: 'Unknown template.' }, { status: 400 });
  const title = t?.title ?? (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'Give the policy a title.' }, { status: 400 });
  const db = getTenantDb(c.orgId);
  const [row] = await db.query((tx) =>
    tx.insert(orgPolicies)
      .values({ orgId: c.orgId, templateKey: t?.key ?? null, title, body: t?.body ?? `# ${title}\n\n`, ownerId: c.userId })
      .returning({ id: orgPolicies.id })
  );
  return NextResponse.json({ id: row.id }, { status: 201 });
}
