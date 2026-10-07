import { NextRequest, NextResponse } from 'next/server';
import { findShare, verifyCode, signViewerPass, SHARE_COOKIE, SHARE_LIMITS } from '@/lib/record-shares';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

/** Checks the code and, if it is right, gives this browser a half-hour pass to the record. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!(await checkRateLimit(`share-verify:${getClientIP(request)}`, 20, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  }
  const { token } = await params;
  const { email, code } = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  const share = await findShare(token);
  if (!share || typeof email !== 'string' || typeof code !== 'string' || !(await verifyCode(share, email, code))) {
    return NextResponse.json({ error: 'That code is not right, or it has expired. Ask for a new one.' }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SHARE_COOKIE, signViewerPass(share.id, email), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/shared', maxAge: SHARE_LIMITS.viewerMinutes * 60,
  });
  return res;
}
