import { NextResponse } from 'next/server';
import { superAdminCaller, roleMatrix } from '@/lib/rbac-admin';

export const dynamic = 'force-dynamic';

/** What each role can do, from the matrix in lib/capabilities.ts that authorisation actually reads. Super admins only. */
export async function GET() {
  if (!(await superAdminCaller())) return NextResponse.json({ error: 'Only a super admin can see permissions.' }, { status: 403 });
  return NextResponse.json(roleMatrix());
}
