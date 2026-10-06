import { NextResponse } from 'next/server';
import { superAdminCaller, listPermissionLog } from '@/lib/rbac-admin';

export const dynamic = 'force-dynamic';

/** The last 200 permission changes, newest first. Super admins only. */
export async function GET() {
  if (!(await superAdminCaller())) return NextResponse.json({ error: 'Only a super admin can see permissions.' }, { status: 403 });
  return NextResponse.json({ entries: await listPermissionLog() });
}
