import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, agents, and, eq } from '@aic/db';
import { orgCaller } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { signState, verifyState } from '@/lib/integrations/state';
import { appUrl } from '@/lib/app-url';
import { loadAgent } from '@/lib/agents/runtime';
import { agentToken, agentSignInUrl, redeemSignIn, SP_AGENT_COOKIE, SP_TENANT_COOKIE } from '@/lib/agents/sharepoint';
import type { AgentTool } from '@/lib/agents/config';

export const dynamic = 'force-dynamic';

const COOKIE_PATH = '/api/agents/sharepoint';

/**
 * Microsoft returns here twice.
 *
 * First after admin consent, with the tenant in the address. That tenant is
 * not trusted: AIC checks the consent took (a token for the tenant), then
 * sends the administrator to sign in at that tenant's own sign-in page.
 *
 * Then after that sign-in, with a code. AIC redeems it and reads the tenant
 * from the ID token Microsoft returns. Only if it is the same tenant, and the
 * person is a member there rather than a guest, is the tenant set on the
 * agent's SharePoint tools.
 */
export async function GET(request: NextRequest) {
  const agentId = request.cookies.get(SP_AGENT_COOKIE)?.value ?? '';
  const redirectUri = `${appUrl()}/api/agents/sharepoint/callback`;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(isUuid(agentId) ? `/agents/${agentId}?${q}` : `/agents?${q}`, appUrl()));
    res.cookies.delete({ name: SP_AGENT_COOKIE, path: COOKIE_PATH });
    res.cookies.delete({ name: SP_TENANT_COOKIE, path: COOKIE_PATH });
    return res;
  };
  const c = await orgCaller({ admin: true });
  if ('error' in c) return back('sharepoint=permission');
  const p = request.nextUrl.searchParams;
  const state = verifyState(p.get('state'));
  if (!state || state.orgId !== c.orgId || state.userId !== c.userId) return back('sharepoint=state');
  if (p.get('error')) return back('sharepoint=declined');
  if (!isUuid(agentId)) return back('sharepoint=failed');

  // Step 1: back from consent.
  const code = p.get('code');
  if (!code) {
    const tenant = (p.get('tenant') ?? '').toLowerCase();
    if (!isUuid(tenant)) return back('sharepoint=failed');
    try { await agentToken(tenant); } catch { return back('sharepoint=failed'); }
    const res = NextResponse.redirect(agentSignInUrl(tenant, signState(c.orgId, c.userId), redirectUri));
    res.cookies.set(SP_TENANT_COOKIE, tenant, { httpOnly: true, secure: true, sameSite: 'lax', path: COOKIE_PATH, maxAge: 900 });
    return res;
  }

  // Step 2: back from sign-in.
  const tenant = request.cookies.get(SP_TENANT_COOKIE)?.value ?? '';
  if (!isUuid(tenant)) return back('sharepoint=state');
  const who = await redeemSignIn(tenant, code, redirectUri);
  if (!who || who.tid !== tenant.toLowerCase() || !who.homeTenant) return back('sharepoint=wrongtenant');

  const a = await loadAgent(c.orgId, agentId);
  if (!a) return back('sharepoint=failed');
  const tools = ((a.tools as AgentTool[]) ?? []).map((t) => (t.kind === 'sharepoint' && !t.tenantId ? { ...t, tenantId: who.tid } : t));
  await getTenantDb(c.orgId).query((tx) => tx.update(agents).set({ tools, updatedAt: new Date() }).where(and(eq(agents.id, a.id), eq(agents.orgId, c.orgId))));
  return back('sharepoint=connected');
}
