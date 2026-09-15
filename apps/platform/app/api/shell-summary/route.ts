import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { Session } from 'next-auth';
import { buildOrgOverview } from '@/lib/org-overview';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shell-summary — the small slice of real org data the dashboard
 * shell (header badges, phase tracker, pulse bar) needs on every page, on
 * every page load, not just the Overview page.
 *
 * Built on buildOrgOverview rather than its own queries so the shell can
 * never show a division, status or decision count that disagrees with what
 * /overview reports for the same org - one builder, both readers, same
 * reasoning as the client/insurer split in lib/org-overview.ts itself.
 *
 * Everything returned here is a stored field or a count, same as the rest
 * of the overview - nothing here is invented to fill a gap on the page.
 * Where an org genuinely has no value yet (division never set, no
 * decisions recorded), the field comes back null/0 and the shell shows an
 * honest empty state instead of a placeholder number.
 */
export async function GET() {
  try {
    const session = (await getSession()) as Session | null;
    if (!session || !session.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overview = await buildOrgOverview(session.user.orgId);
    if (!overview) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const openCorrections =
      (overview.corrections.byStatus['SUBMITTED'] ?? 0) +
      (overview.corrections.byStatus['UNDER_REVIEW'] ?? 0);

    return NextResponse.json({
      organisation: {
        name: overview.organisation.name,
        division: overview.organisation.division,
        divisionName: overview.organisation.divisionName,
        certificationStatus: overview.organisation.certificationStatus,
        integrityScore: overview.organisation.integrityScore,
      },
      decisions: {
        recorded: overview.decisions.recorded,
        humanOverrideRate: overview.decisions.humanOverrideRate,
      },
      corrections: {
        open: openCorrections,
      },
    });
  } catch (error) {
    console.error('[SECURITY] Shell Summary GET Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve shell summary' }, { status: 500 });
  }
}
