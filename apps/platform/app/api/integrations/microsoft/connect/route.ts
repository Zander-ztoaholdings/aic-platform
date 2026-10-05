import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { microsoftConfigured, consentUrl } from '@/lib/integrations/microsoft';
import { signState } from '@/lib/integrations/state';
import { appUrl } from '@/lib/app-url';

/** Starts a Microsoft 365 connection: returns the admin-consent link, bound to this organisation. */
export async function POST() {
  const caller = await orgCaller({ manage: true });
  if ('error' in caller) return caller.error;
  if (!microsoftConfigured()) {
    return NextResponse.json({ error: 'Microsoft 365 connections are not switched on for this AIC server yet.' }, { status: 503 });
  }
  return NextResponse.json({ url: consentUrl(signState(caller.orgId, caller.userId), `${appUrl()}/api/integrations/microsoft/callback`) });
}
