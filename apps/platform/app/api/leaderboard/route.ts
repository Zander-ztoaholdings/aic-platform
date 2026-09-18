import { NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';
import { auth } from '@aic/auth';

/**
 * The benchmark view across the register.
 *
 * WHAT THIS ROUTE USED TO DO, AND WHY IT COULD NOT STAY.
 *
 *   1. NO SERVER-SIDE AUTHENTICATION. It relied entirely on the middleware,
 *      which checks that a cookie with the right NAME exists and explicitly
 *      does not verify it — its own header says so. A request carrying
 *      `Cookie: authjs.session-token=anything` reached this handler.
 *   2. NO CONSENT CHECK. It listed every organisation in the database by name,
 *      tier and integrity score. `organizations.public_directory_visible` is
 *      the flag that records whether a client agreed to appear publicly, and
 *      this route did not read it. Clients who never opted in were ranked by
 *      score to anyone who asked.
 *   3. FABRICATED FIGURES. `avgIntegrity: 84`, `humanInterventionRate: 12.4%`
 *      and `totalVerifiedAudits: 1242` were literals, and `maturityScore` was
 *      the constant 85 with a comment calling it a placeholder. A certification
 *      body publishing an invented count of verified audits is the same fault
 *      that got /api/v1/insurance/risk-score withdrawn, and it is the one fault
 *      this organisation cannot survive being caught at.
 *
 * It now requires a real session, lists only organisations that consented, and
 * computes every number it returns.
 *
 * SMALL-COHORT SUPPRESSION. Aggregates are withheld below MIN_COHORT. With a
 * handful of participants an "average across the register" published beside a
 * ranked list of those same participants is not an aggregate — it is each
 * organisation's own score, recoverable with arithmetic. Returning null and
 * saying why is the honest answer until the cohort is large enough to hide in.
 */

const MIN_COHORT = 5;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getSystemDb();

    const listed = await db.execute(sql`
      SELECT
        o.id,
        o.name,
        o.tier,
        o.integrity_score AS "integrityScore",
        COALESCE(COUNT(al.id) FILTER (WHERE al.type = 'FORMAL'), 0) AS "formalAudits"
      FROM organizations o
      LEFT JOIN audit_ledger al ON o.id = al.org_id
      WHERE o.public_directory_visible = TRUE
      GROUP BY o.id
      ORDER BY o.integrity_score DESC NULLS LAST
      LIMIT 10
    `);

    const [cohort]: any = await db.execute(sql`
      SELECT COUNT(*)::int AS n, AVG(integrity_score)::numeric AS avg_integrity
      FROM organizations
      WHERE public_directory_visible = TRUE
    `);

    const n = Number(cohort?.n ?? 0);

    if (n < MIN_COHORT) {
      return NextResponse.json({
        leaderboard: listed.rows,
        cohortSize: n,
        globalMetrics: null,
        suppressed: {
          reason: 'cohort_below_threshold',
          detail:
            `Register-wide figures are withheld until at least ${MIN_COHORT} organisations have ` +
            `consented to public listing. Below that they would disclose individual scores.`,
        },
      });
    }

    const [overrides]: any = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_human_override)::int AS overridden
      FROM decision_records
    `);

    const [ledger]: any = await db.execute(sql`
      SELECT COUNT(*)::int AS formal FROM audit_ledger WHERE type = 'FORMAL'
    `);

    const totalDecisions = Number(overrides?.total ?? 0);
    const overridden = Number(overrides?.overridden ?? 0);

    return NextResponse.json({
      leaderboard: listed.rows,
      cohortSize: n,
      globalMetrics: {
        avgIntegrity: cohort?.avg_integrity === null ? null : Number(cohort.avg_integrity),
        // Null rather than 0% when nothing has been recorded: no decisions is
        // not the same statement as no human ever intervened.
        humanInterventionRate:
          totalDecisions > 0 ? Number(((overridden / totalDecisions) * 100).toFixed(1)) : null,
        decisionsRecorded: totalDecisions,
        formalLedgerEntries: Number(ledger?.formal ?? 0),
      },
    });
  } catch (error) {
    console.error('[LEADERBOARD] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
