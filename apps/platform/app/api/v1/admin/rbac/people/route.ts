import { NextResponse } from 'next/server';
import { superAdminCaller, listStaffWithOverrides } from '@/lib/rbac-admin';

export const dynamic = 'force-dynamic';

/** AIC staff, each with what they can do, why, and their per-person exceptions. Super admins only. */
export async function GET() {
  const me = await superAdminCaller();
  if (!me) return NextResponse.json({ error: 'Only a super admin can see permissions.' }, { status: 403 });
  return NextResponse.json({ me: me.id, people: await listStaffWithOverrides() });
}
