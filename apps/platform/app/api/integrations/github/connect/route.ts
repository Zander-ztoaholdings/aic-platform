import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { githubAppConfigured, installUrl } from '@/lib/integrations/github';
import { signState } from '@/lib/integrations/state';

/** Starts a GitHub connection: returns the App install link, bound to this organisation. */
export async function POST() {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  if (!githubAppConfigured()) {
    return NextResponse.json({ error: 'GitHub connections are not switched on for this AIC server yet.' }, { status: 503 });
  }
  return NextResponse.json({ url: installUrl(signState(caller.orgId, caller.userId)) });
}
