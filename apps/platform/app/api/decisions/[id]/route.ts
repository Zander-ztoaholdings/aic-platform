import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, decisionRecords, users, eq, and } from '@aic/db';
import { auth } from '@aic/auth';
import { resolveApiKey } from '@/lib/api-key-auth';
import { isUuid } from '@/lib/policy-hash';
import { isExpired, publicReview } from '@/lib/decision-review';

/**
 * One decision, for the system that sent it (API key) or a person (session).
 * A system holding a decision polls this until review_status is approved or
 * overridden, and acts on final_outcome.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = (session?.user?.orgId as string | undefined) ?? (await resolveApiKey(request));
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [row] = await getTenantDb(orgId).query((tx) =>
    tx.select({ d: decisionRecords, reviewerName: users.name }).from(decisionRecords)
      .leftJoin(users, eq(users.id, decisionRecords.reviewedBy))
      .where(and(eq(decisionRecords.id, id), eq(decisionRecords.orgId, orgId))).limit(1)
  );
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const d = row.d;
  const status = isExpired(d.reviewStatus, d.reviewDueAt) ? 'expired' : d.reviewStatus;
  return NextResponse.json({
    ...publicReview({ ...d, reviewStatus: status, reviewerName: row.reviewerName }),
    system_name: d.systemName,
    outcome: d.outcome,
    created_at: d.createdAt,
  });
}
