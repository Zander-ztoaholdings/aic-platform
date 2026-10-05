import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { FRAMEWORKS } from '@/lib/controls';
import { computeControls } from '@/lib/controls-data';

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const controls = await computeControls(orgId);
  return NextResponse.json({ frameworks: FRAMEWORKS, controls });
}
