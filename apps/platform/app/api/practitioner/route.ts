import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';

/**
 * CAAP practitioner records. The credential has not launched (Q3 2027), so
 * there are none. This route used to return a mocked "LEVEL 2 AUDITOR" with
 * 65% CPD progress, a licence number and a passed exam, shown to every staff
 * member as their own record. It now says plainly that nothing exists yet.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ launched: false, launchTarget: 'Q3 2027', practitioners: [] });
}
