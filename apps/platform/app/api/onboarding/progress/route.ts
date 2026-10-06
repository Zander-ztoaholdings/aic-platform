import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/registers/caller';
import { setupDone, progressFrom } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

/** The set-up guide's steps and which are done, read from the record. */
export async function GET() {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  return NextResponse.json(progressFrom(await setupDone(c.orgId), c.isAdmin));
}
