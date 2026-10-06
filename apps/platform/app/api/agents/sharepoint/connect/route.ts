import { NextRequest, NextResponse } from 'next/server';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { signState } from '@/lib/integrations/state';
import { appUrl } from '@/lib/app-url';
import { loadAgent } from '@/lib/agents/runtime';
import { agentConsentUrl, sharePointConfigured, SP_AGENT_COOKIE } from '@/lib/agents/sharepoint';

export const dynamic = 'force-dynamic';

/**
 * Starts Microsoft's admin consent for AIC's agent app (Sites.Selected only).
 * Consent alone opens no site; the administrator grants each site afterwards.
 */
export async function POST(request: NextRequest) {
  const c = await orgCaller({ admin: true });
  if ('error' in c) return c.error;
  if (!sharePointConfigured()) return NextResponse.json({ error: 'SharePoint for agents is not switched on for this AIC server yet.' }, { status: 503 });
  const { agentId } = (await request.json().catch(() => ({}))) as { agentId?: string };
  if (!agentId || !isUuid(agentId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, agentId);
    if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const res = NextResponse.json({ url: agentConsentUrl(signState(c.orgId, c.userId), `${appUrl()}/api/agents/sharepoint/callback`) });
    res.cookies.set(SP_AGENT_COOKIE, agentId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/agents/sharepoint', maxAge: 900 });
    return res;
  });
}
