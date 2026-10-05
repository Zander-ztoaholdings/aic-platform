import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { computeControls } from '@/lib/controls-data';
import { canManageCompliance } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { frameworks, controls, common } = await computeControls(orgId);
  return NextResponse.json({ frameworks, controls, common, canUpload: canManageCompliance(session?.user?.role as string | undefined) });
}
