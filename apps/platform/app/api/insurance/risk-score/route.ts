import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { resolveApiKey } from '../../../../lib/api-key-auth';
import { buildOrgOverview } from '../../../../lib/org-overview';
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
 * maps that to price, because that is their job and not ours.
 *
 * WHY IT IS A PROJECTION AND NOT ITS OWN QUERY.
 *
 * It reads the same buildOrgOverview() the client's own overview page reads.
 * Two separate assemblies would eventually disagree — one gets a new field, a
 * filter changes on one side only — and the failure mode is the worst one
 * available here: the client managing one picture of their exposure while the
 * underwriter prices another, with neither able to see the difference. One
 * builder, two projections. What the insurer is told is a strict subset of
 * what the client can already see about themselves.
 *
 * Authenticated by session (the client viewing their own extract) or by API key
 * (the insurer pulling it).
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

    const o = await buildOrgOverview(orgId);
    if (!o) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      generated_at: o.generatedAt,
      audience,
      organisation: {
        name: o.organisation.name,
        division: o.organisation.division,
        standard_version: o.organisation.standardVersion,
        tier: o.organisation.tier,
        certification_status: o.organisation.certificationStatus,
      },
      certificate: o.certificate,
      observations: {
        integrity_score: o.organisation.integrityScore,
        requirements_by_status: o.requirements.byStatus,
        evidence_by_verification_outcome: o.evidence.byVerificationOutcome,
        last_evidence_verified_at: o.evidence.lastVerifiedAt,
        open_findings: o.findings.open.map((f) => ({ severity: f.severity, overdue: f.overdue })),
        open_findings_count: o.findings.openCount,
        ai_systems_declared: o.inventory.total,
        ai_systems_in_production: o.inventory.inProduction,
        // Named without naming: an underwriter needs to know the inventory is
        // incomplete, but the name of an undeclared internal system is the
        // client's information and not load-bearing for pricing.
        ai_systems_deciding_but_undeclared: o.inventory.undeclaredButDeciding.length,
        accountable_persons_on_record: o.accountability.onRecord,
        decisions_recorded: o.decisions.recorded,
        human_overrides: o.decisions.humanOverrides,
        // Rate is stated alongside its denominator on purpose. A percentage
        // with the sample size hidden is the easiest number in this payload
        // to misread.
        human_override_rate: o.decisions.humanOverrideRate,
        corrections_by_status: o.corrections.byStatus,
        // Codes and severities, not the prose. The prose is written for the
        // client's own reading and would land as an accusation in a file the
        // client never sees.
        gaps: o.gaps.map((g) => ({ code: g.code, severity: g.severity, count: g.count ?? null })),
      },
      underwriting:
        'AIC issues observations only. Rating, pricing, acceptance and any ' +
        'decision to decline are the insurer’s. AIC does not grade, score ' +
        'for underwriting purposes, or recommend an outcome for any ' +
        'organisation.',
      scope: o.scope,
    });
  } catch (error) {
    console.error('[INSURANCE] Extract error:', (error as Error).message);
    return NextResponse.json({ error: 'Failed to build extract' }, { status: 500 });
  }
}
