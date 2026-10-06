import { NextRequest, NextResponse } from 'next/server';
import { publicLink } from '@/lib/onboarding-links';

export const dynamic = 'force-dynamic';

/** What the welcome page and the registration wizard may show for a client onboarding link. Public by design. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const l = await publicLink(token);
  if (!l) return NextResponse.json({ error: 'This link is not recognised.' }, { status: 404 });
  return NextResponse.json(l, { headers: { 'Cache-Control': 'no-store' } });
}
