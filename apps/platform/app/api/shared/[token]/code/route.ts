import { NextRequest, NextResponse } from 'next/server';
import { findShare, requestCode } from '@/lib/record-shares';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

/**
 * Asks for a one-time code. Answers the same whether or not the address is
 * the one the record was shared with, so it cannot be used to find out.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!(await checkRateLimit(`share-code:${getClientIP(request)}`, 10, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  }
  const { token } = await params;
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const share = await findShare(token);
  if (share && typeof email === 'string') await requestCode(share, email);
  return NextResponse.json({ ok: true, message: 'If that is the address this record was shared with, a six-digit code is on its way to it.' });
}
