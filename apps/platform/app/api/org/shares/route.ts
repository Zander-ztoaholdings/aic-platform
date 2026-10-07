import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { canManageEstate } from '@/lib/roles';
import { validateShare, createShare, listShares } from '@/lib/record-shares';
import { checkRateLimit } from '@/lib/rate-limit';

const missing = (e: unknown) => ((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === '42P01';
const notReady = () => NextResponse.json({ error: 'Sharing is not switched on for this server yet (migration 021).' }, { status: 503 });

/** The organisation's shares of its record, with how often each was opened. */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  try {
    return NextResponse.json({ shares: await listShares(c.orgId), canShare: canManageEstate(c.role) });
  } catch (e) {
    if (missing(e)) return NextResponse.json({ shares: [], canShare: false, notReady: true });
    throw e;
  }
}

/** Share a period of the record with a named person. */
export async function POST(request: Request) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!canManageEstate(c.role)) return NextResponse.json({ error: 'Only members of the organisation can share its record.' }, { status: 403 });
  if (!(await checkRateLimit(`share:${c.orgId}`, 30, 60 * 60_000)).allowed) return NextResponse.json({ error: 'Too many shares in a short time. Try again later.' }, { status: 429 });
  const v = validateShare((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const s = await createShare(c.orgId, c.userId, v.value);
    return NextResponse.json({
      ok: true, url: s.url,
      message: s.emailed
        ? `Shared with ${v.value.recipientName}. AIC emailed them the link; they confirm their address with a code before it opens.`
        : `Shared, but the email could not be sent. Copy the link and send it to ${v.value.recipientName} yourself; it still only opens for ${v.value.recipientEmail}.`,
    });
  } catch (e) {
    if (missing(e)) return notReady();
    throw e;
  }
}
