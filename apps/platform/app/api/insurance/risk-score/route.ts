import { NextResponse } from 'next/server';
import {
  getTenantDb,
  organizations,
  issuedCertifications,
  auditRequirements,
  auditDocuments,
  auditFindings,
  aiSystems,
  accountablePersons,
  decisionRecords,
  correctionRequests,
  eq,
  and,
  desc,
  count,
  isNull,
  max,
} from '@aic/db';
import { getSession } from '../../../../lib/auth';
import { resolveApiKey } from '../../../../lib/api-key-auth';
import type { Session } from 'next-auth';

/**
 * The underwriting extract.
 *
 * WHAT THIS USED TO DO, AND WHY IT HAD TO STOP.
 *
 * It returned `insurance_risk_rating` on a AAA / AA / A / BBB / "C
 * (UNINSURABLE)" scale and a `recommendation` of APPROVED_FOR_DISCOUNT or
 * REQUIRE_REMEDIATION, both derived from a single integrity score. Three
 * separate problems with that, any one of which is disqualifying:
 *
 *   1. Pricing and acceptance are the insurer's licensed function. Handing an
 *      underwriter a grade and a decision invites the question of whether AIC
 *      is acting as an intermediary it is not authorised to be.
 *   2. A certification body that recommends outcomes is advising. That is the
 *      line accreditation turns on, and it is not one to be standing near while
 *      an application is open.
 *   3. "UNINSURABLE" is a published conclusion about a named company that AIC
 *      has no standing to reach and would not enjoy defending.
 *
 * So this returns observations and nothing else. Counts, coverage, rates,
 * dates — each traceable to a record an assessor verified. The underwriter
 * maps that to price, because that is their job and not ours. That restraint is
 * also the strongest thing AIC can say in an insurer's boardroom: we tell you
 * what is true, you decide what it is worth.
 *
 * Authenticated by session (the client viewing their own extract) or by API key
 * (the insurer pulling it). Previously session-only, which locked out the one
 * party it exists for.
 */
export async function GET(request: Request) {
  try {
    let orgId: string | null = null;
    let audience: 'client' | 'insurer' = 'client';

    const session = (await getSession()) as Session | null;
    if (session?.user?.orgId) {
      orgId = session.user.orgId as string;
    } else {
      orgId = await resolveApiKey(request);
      audience = 'insurer';
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const [org] = await tx
        .select({
          name: organizations.name,
          tier: organizations.tier,
          division: organizations.division,
          standardVersion: organizations.standardVersion,
          integrityScore: organizations.integrityScore,
          certificationStatus: organizations.certificationStatus,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const [cert] = await tx
        .select({
          certNumber: issuedCertifications.certNumber,
          standard: issuedCertifications.standard,
          status: issuedCertifications.status,
          issueDate: issuedCertifications.issueDate,
          expiryDate: issuedCertifications.expiryDate,
        })
        .from(issuedCertifications)
        .where(eq(issuedCertifications.orgId, orgId))
        .orderBy(desc(issuedCertifications.issueDate))
        .limit(1);

      const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

      const requirementsByStatus = await tx
        .select({ status: auditRequirements.status, n: count() })
        .from(auditRequirements)
        .where(eq(auditRequirements.orgId, orgId))
        .groupBy(auditRequirements.status);

      const evidenceByOutcome = await tx
        .select({ outcome: auditDocuments.verificationOutcome, n: count() })
        .from(auditDocuments)
        .where(eq(auditDocuments.orgId, orgId))
        .groupBy(auditDocuments.verificationOutcome);

      const [verified] = await tx
        .select({ last: max(auditDocuments.verifiedAt) })
        .from(auditDocuments)
        .where(eq(auditDocuments.orgId, orgId));

      const findingsByStatus = await tx
        .select({ status: auditFindings.status, severity: auditFindings.severity, n: count() })
        .from(auditFindings)
        .where(eq(auditFindings.orgId, orgId))
        .groupBy(auditFindings.status, auditFindings.severity);

      const systems = await one(
        tx
          .select({ n: count() })
          .from(aiSystems)
          .where(and(eq(aiSystems.orgId, orgId), eq(aiSystems.isActive, true)))
      );

      const persons = await one(
        tx
          .select({ n: count() })
          .from(accountablePersons)
          .where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt)))
      );

      const decisions = await one(
        tx.select({ n: count() }).from(decisionRecords).where(eq(decisionRecords.orgId, orgId))
      );
      const overrides = await one(
        tx
          .select({ n: count() })
          .from(decisionRecords)
          .where(and(eq(decisionRecords.orgId, orgId), eq(decisionRecords.isHumanOverride, true)))
      );

      const correctionsByStatus = await tx
        .select({ status: correctionRequests.status, n: count() })
        .from(correctionRequests)
        .where(eq(correctionRequests.orgId, orgId))
        .groupBy(correctionRequests.status);

      const tally = (rows: { status: string | null; n: number }[]) =>
        Object.fromEntries(rows.map((r) => [r.status ?? 'unspecified', Number(r.n)]));

      return NextResponse.json({
        generated_at: new Date().toISOString(),
        audience,
        organisation: {
          name: org.name,
          division: org.division,
          standard_version: org.standardVersion,
          tier: org.tier,
          certification_status: org.certificationStatus,
        },
        certificate: cert
          ? {
              number: cert.certNumber,
              standard: cert.standard,
              status: cert.status,
              issued: cert.issueDate,
              expires: cert.expiryDate,
            }
          : null,
        observations: {
          integrity_score: org.integrityScore,
          requirements_by_status: tally(requirementsByStatus),
          evidence_by_verification_outcome: tally(
            evidenceByOutcome.map((r) => ({ status: r.outcome, n: r.n }))
          ),
          last_evidence_verified_at: verified?.last ?? null,
          open_findings: findingsByStatus
            .filter((r) => r.status !== 'CLOSED')
            .map((r) => ({ severity: r.severity, count: Number(r.n) })),
          ai_systems_declared: systems,
          accountable_persons_on_record: persons,
          decisions_recorded: decisions,
          human_overrides: overrides,
          // Rate is stated alongside its denominator on purpose. A percentage
          // with the sample size hidden is the easiest number in this payload
          // to misread.
          human_override_rate:
            decisions > 0 ? Number((overrides / decisions).toFixed(4)) : null,
          corrections_by_status: tally(correctionsByStatus),
        },
        underwriting:
          'AIC issues observations only. Rating, pricing, acceptance and any ' +
          'decision to decline are the insurer’s. AIC does not grade, score ' +
          'for underwriting purposes, or recommend an outcome for any ' +
          'organisation.',
        scope:
          'Certification assesses governance against the published AIC standard. ' +
          'It is not a determination of legal compliance in any jurisdiction, and ' +
          'neither substitutes for the other.',
      });
    });
  } catch (error) {
    console.error('[INSURANCE] Extract error:', error);
    return NextResponse.json({ error: 'Failed to build extract' }, { status: 500 });
  }
}
