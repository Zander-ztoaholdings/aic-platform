import { NextResponse } from 'next/server';
import { getTenantDb, integrationChecks, orgPolicies, policyAcceptances, auditRequirements, auditDocuments, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { evaluateControls, FRAMEWORKS, type EvidenceInput } from '@/lib/controls';
import { evidenceState } from '@/lib/evidence-vault';
import { CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { TEMPLATE_BY_KEY } from '@/lib/policy-templates';
import { orgMembers } from '@/lib/policies';

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getTenantDb(orgId);
  const { checks, policies, acceptances, reqs, docs } = await db.query(async (tx) => ({
    checks: await tx.select({ key: integrationChecks.checkKey, status: integrationChecks.status }).from(integrationChecks).where(eq(integrationChecks.orgId, orgId)),
    policies: await tx.select().from(orgPolicies).where(eq(orgPolicies.orgId, orgId)),
    acceptances: await tx.select().from(policyAcceptances).where(eq(policyAcceptances.orgId, orgId)),
    reqs: await tx.select().from(auditRequirements).where(eq(auditRequirements.orgId, orgId)),
    docs: await tx.select().from(auditDocuments).where(eq(auditDocuments.orgId, orgId)),
  }));
  const members = await orgMembers(orgId);

  const input: EvidenceInput = { checks: {}, policies: {}, requirements: {} };
  for (const c of checks) (input.checks[c.key] ??= []).push(c.status);
  for (const p of policies) {
    if (!p.templateKey) continue;
    const ids = new Set(acceptances.filter((a) => a.policyId === p.id && a.version === p.publishedVersion).map((a) => a.userId));
    input.policies[p.templateKey] = { id: p.id, published: p.publishedVersion > 0, acceptedAll: members.length > 0 && members.every((m) => ids.has(m.id)) };
  }
  for (const r of reqs) {
    if (!r.code) continue;
    const mine = docs.filter((d) => d.requirementId === r.id).map((d) => ({
      id: d.id, title: d.title, fileSize: d.fileSize, createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      verificationOutcome: d.verificationOutcome, verificationNotes: d.verificationNotes, verifiedAt: null, supersededBy: d.supersededBy,
    }));
    input.requirements[r.code] = { id: r.id, state: evidenceState(mine), text: r.title, right: r.rightCode };
  }

  const controls = evaluateControls(
    input,
    (k) => CHECK_BY_KEY[k]?.title ?? k,
    (k) => TEMPLATE_BY_KEY[k]?.title ?? k,
  );
  return NextResponse.json({ frameworks: FRAMEWORKS, controls });
}
