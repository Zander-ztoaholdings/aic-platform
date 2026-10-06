import { NextResponse } from 'next/server';
import { superAdminCaller, capabilityList } from '@/lib/rbac-admin';

export const dynamic = 'force-dynamic';

/** Every capability the platform checks, with what it allows. Super admins only. */
export async function GET() {
  if (!(await superAdminCaller())) return NextResponse.json({ error: 'Only a super admin can see permissions.' }, { status: 403 });
  return NextResponse.json(capabilityList());
}
