/**
 * SharePoint for agents: Microsoft Graph calls through AIC's agent app.
 *
 * AIC's agent app is a separate Entra app from the one that reads evidence
 * for certification (lib/integrations/microsoft.ts), so an agent's access and
 * AIC's assessment access never share a credential. It holds one application
 * permission, Sites.Selected, which opens nothing by itself: the client's
 * administrator grants it each site, read or write, and can take it back.
 *
 * Environment: MS_AGENT_CLIENT_ID, MS_AGENT_CLIENT_SECRET. For tests:
 * MS_LOGIN_URL, MS_GRAPH_URL (shared with the evidence app).
 */
import { docxText } from '@/lib/ai/docx-text';
import { graphItemPath, graphSitePath, SP_MAX_READ_BYTES, type SharePointTool, type SpOp } from './sharepoint-scope';

const LOGIN = () => (process.env.MS_LOGIN_URL || 'https://login.microsoftonline.com').replace(/\/$/, '');
const GRAPH = () => (process.env.MS_GRAPH_URL || 'https://graph.microsoft.com').replace(/\/$/, '');
const MAX_CHARS = 30_000;

/** Holds which agent a consent was started from, for the callback. */
export const SP_AGENT_COOKIE = 'aic_sp_agent';

export const agentAppId = () => process.env.MS_AGENT_CLIENT_ID ?? null;
export const sharePointConfigured = () => !!(process.env.MS_AGENT_CLIENT_ID && process.env.MS_AGENT_CLIENT_SECRET);

export function agentConsentUrl(state: string, redirectUri: string): string {
  const qs = new URLSearchParams({ client_id: process.env.MS_AGENT_CLIENT_ID!, scope: 'https://graph.microsoft.com/.default', redirect_uri: redirectUri, state });
  return `${LOGIN()}/organizations/v2.0/adminconsent?${qs}`;
}

/** Holds the consented tenant between the consent and the sign-in that proves it. */
export const SP_TENANT_COOKIE = 'aic_sp_tenant';

/**
 * The tenant Microsoft puts on the consent redirect is not proof of anything
 * (anyone can edit the address, and a token for a tenant only shows that
 * someone there consented, not that this person belongs to it). So after
 * consent the administrator signs in once, at that tenant's own sign-in
 * page, and AIC reads the tenant from the ID token Microsoft returns.
 */
export function agentSignInUrl(tenantId: string, state: string, redirectUri: string): string {
  const qs = new URLSearchParams({ client_id: process.env.MS_AGENT_CLIENT_ID!, response_type: 'code', response_mode: 'query', scope: 'openid', redirect_uri: redirectUri, state, prompt: 'select_account' });
  return `${LOGIN()}/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${qs}`;
}

/** Redeems the sign-in code and returns who signed in, from the ID token. */
export async function redeemSignIn(tenantId: string, code: string, redirectUri: string, f: typeof fetch = fetch): Promise<{ tid: string; homeTenant: boolean } | null> {
  const res = await f(`${LOGIN()}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.MS_AGENT_CLIENT_ID ?? '', client_secret: process.env.MS_AGENT_CLIENT_SECRET ?? '', grant_type: 'authorization_code', code, redirect_uri: redirectUri, scope: 'openid' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const idToken = ((await res.json()) as { id_token?: string }).id_token;
  // Received directly from Microsoft over TLS, so its claims can be read without checking the signature.
  const part = idToken?.split('.')[1];
  if (!part) return null;
  let claims: { tid?: string; iss?: string; idp?: string };
  try { claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); } catch { return null; }
  if (!claims.tid) return null;
  // A guest from another organisation signs in with an idp claim naming their own tenant.
  const homeTenant = !claims.idp || claims.idp === claims.iss || claims.idp.includes(claims.tid);
  return { tid: claims.tid.toLowerCase(), homeTenant };
}

export class SharePointError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const tokens = new Map<string, { token: string; until: number }>();

export async function agentToken(tenantId: string, f: typeof fetch = fetch): Promise<string> {
  const hit = tokens.get(tenantId);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await f(`${LOGIN()}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.MS_AGENT_CLIENT_ID ?? '', client_secret: process.env.MS_AGENT_CLIENT_SECRET ?? '', scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new SharePointError(403, 'Microsoft refused AIC’s agent app for this tenant. The administrator may not have consented, or has removed it.');
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  tokens.set(tenantId, { token: j.access_token, until: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 300) * 1000 });
  return j.access_token;
}

async function graph(token: string, path: string, init: RequestInit = {}, f: typeof fetch = fetch): Promise<Response> {
  return f(`${GRAPH()}/v1.0${path}`, { ...init, redirect: 'manual', headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
}

export type Located = { siteId: string; siteName: string; driveId: string; libraryName: string };
const located = new Map<string, { at: number; v: Located }>();

/** Finds the site and library. 403 or 404 on the site means it has not been granted to AIC's agent app. */
export async function locate(tool: SharePointTool, token: string, f: typeof fetch = fetch): Promise<Located> {
  const key = `${tool.tenantId}|${tool.siteUrl}|${tool.library}`;
  const hit = located.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
  const s = await graph(token, `${graphSitePath(tool.siteUrl)}?$select=id,displayName`, {}, f);
  if (s.status === 403 || s.status === 404 || s.status === 401) throw new SharePointError(403, `AIC’s agent app has not been given ${tool.siteUrl}. The site’s administrator grants it (see the set-up steps on the agent’s Tools tab).`);
  if (!s.ok) throw new SharePointError(s.status, `SharePoint answered ${s.status} for the site.`);
  const site = (await s.json()) as { id: string; displayName: string };
  const d = await graph(token, `/sites/${encodeURIComponent(site.id)}/drives?$select=id,name`, {}, f);
  if (!d.ok) throw new SharePointError(d.status, `SharePoint answered ${d.status} for the site’s libraries.`);
  const drives = ((await d.json()) as { value: { id: string; name: string }[] }).value;
  const drive = drives.find((x) => x.name.toLowerCase() === tool.library.toLowerCase())
    ?? (tool.library.toLowerCase() === 'documents' ? drives.find((x) => x.name === 'Shared Documents') : undefined);
  if (!drive) throw new SharePointError(404, `There is no library called “${tool.library}” on that site. It has: ${drives.map((x) => x.name).join(', ') || 'none'}.`);
  const v = { siteId: site.id, siteName: site.displayName, driveId: drive.id, libraryName: drive.name };
  located.set(key, { at: Date.now(), v });
  return v;
}

/** Runs one checked operation. Errors come back as text for the model, never thrown. */
export async function runSharePoint(tool: SharePointTool, call: SpOp, f: typeof fetch = fetch): Promise<{ ok: boolean; content: string }> {
  if (!sharePointConfigured()) return { ok: false, content: 'SharePoint is not switched on for this AIC server.' };
  if (!tool.tenantId) return { ok: false, content: 'Microsoft 365 is not connected for this tool yet.' };
  try {
    const token = await agentToken(tool.tenantId, f);
    const loc = await locate(tool, token, f);
    if (call.op === 'list') {
      const r = await graph(token, `${graphItemPath(loc.driveId, call.path, ':/children')}?$select=name,size,folder,file,lastModifiedDateTime&$top=200`, {}, f);
      if (r.status === 404) return { ok: false, content: `There is no folder ${call.path || '(top)'} in ${loc.libraryName}.` };
      if (!r.ok) return { ok: false, content: `SharePoint answered ${r.status}.` };
      const items = ((await r.json()) as { value: { name: string; size?: number; folder?: unknown; lastModifiedDateTime?: string }[] }).value;
      if (!items.length) return { ok: true, content: 'The folder is empty.' };
      return { ok: true, content: items.map((i) => (i.folder ? `${i.name}/` : `${i.name}  (${Math.ceil((i.size ?? 0) / 1024)} KB, changed ${i.lastModifiedDateTime?.slice(0, 10) ?? '?'})`)).join('\n') };
    }
    if (call.op === 'read') {
      const m = await graph(token, `${graphItemPath(loc.driveId, call.path, '')}?$select=name,size,file,folder`, {}, f);
      if (m.status === 404) return { ok: false, content: `There is no file ${call.path} in ${loc.libraryName}.` };
      if (!m.ok) return { ok: false, content: `SharePoint answered ${m.status}.` };
      const meta = (await m.json()) as { name: string; size?: number; folder?: unknown };
      if (meta.folder) return { ok: false, content: `${call.path} is a folder; use list.` };
      if ((meta.size ?? 0) > SP_MAX_READ_BYTES) return { ok: false, content: 'That file is over 10 MB.' };
      const c = await graph(token, graphItemPath(loc.driveId, call.path, ':/content'), {}, f);
      let res = c;
      // Graph answers a download with a redirect to a short-lived SharePoint address; follow it only to SharePoint.
      if (c.status >= 300 && c.status < 400) {
        const to = c.headers.get('location');
        if (!to || !/^https:\/\/[a-z0-9-]+\.sharepoint\.com\//i.test(to)) return { ok: false, content: 'SharePoint sent the download somewhere unexpected, so AIC did not follow it.' };
        res = await f(to, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      }
      if (!res.ok) return { ok: false, content: `SharePoint answered ${res.status} for the file.` };
      const buf = Buffer.from(await res.arrayBuffer());
      const text = call.path.toLowerCase().endsWith('.docx') ? docxText(buf) : buf.toString('utf8');
      if (text === null) return { ok: false, content: 'AIC could not read the text of that Word document.' };
      return { ok: true, content: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[cut off at ${MAX_CHARS} characters]` : text };
    }
    const w = await graph(token, `${graphItemPath(loc.driveId, call.path, ':/content')}?@microsoft.graph.conflictBehavior=${call.replace ? 'replace' : 'fail'}`, {
      method: 'PUT', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: call.content,
    }, f);
    if (w.status === 409) return { ok: false, content: `${call.path} already exists. Ask again with replace set to true if it should be overwritten.` };
    if (w.status === 403) return { ok: false, content: 'AIC’s agent app may read this site but not write to it. The administrator grants write separately.' };
    if (!w.ok) return { ok: false, content: `SharePoint answered ${w.status}.` };
    const item = (await w.json()) as { webUrl?: string };
    return { ok: true, content: `Saved ${call.path}${item.webUrl ? ` (${item.webUrl})` : ''}.` };
  } catch (e) {
    return { ok: false, content: e instanceof SharePointError ? e.message : 'Could not reach SharePoint.' };
  }
}

export type AccessCheck = {
  ok: boolean; message: string; siteName?: string; libraryName?: string; siteId?: string;
  /** True when the app could also open the tenant's root site: it holds more than Sites.Selected. */
  wider?: boolean; canWrite?: boolean | null;
};

/**
 * "Check access": proves the grant works and that it is narrow. With only
 * Sites.Selected the app cannot open the tenant's root site; if it can, the
 * administrator gave it more than one site and AIC says so.
 */
export async function checkAccess(tool: SharePointTool, f: typeof fetch = fetch): Promise<AccessCheck> {
  if (!sharePointConfigured()) return { ok: false, message: 'SharePoint is not switched on for this AIC server.' };
  if (!tool.tenantId) return { ok: false, message: 'Connect Microsoft 365 first.' };
  try {
    const token = await agentToken(tool.tenantId, f);
    located.delete(`${tool.tenantId}|${tool.siteUrl}|${tool.library}`);
    const loc = await locate(tool, token, f);
    const root = await graph(token, '/sites/root?$select=id', {}, f);
    const rootId = root.ok ? ((await root.json()) as { id: string }).id : null;
    const wider = !!rootId && rootId !== loc.siteId;
    let canWrite: boolean | null = null;
    const perms = await graph(token, `/sites/${encodeURIComponent(loc.siteId)}/permissions`, {}, f);
    if (perms.ok) {
      const appId = agentAppId();
      const list = ((await perms.json()) as { value: { roles?: string[]; grantedToIdentitiesV2?: { application?: { id?: string } }[]; grantedToIdentities?: { application?: { id?: string } }[] }[] }).value;
      const mine = list.filter((p) => [...(p.grantedToIdentitiesV2 ?? []), ...(p.grantedToIdentities ?? [])].some((g) => g.application?.id === appId));
      if (mine.length) canWrite = mine.some((p) => (p.roles ?? []).some((r) => ['write', 'owner', 'fullcontrol'].includes(r)));
    }
    const gap = tool.access === 'write' && canWrite === false;
    return {
      ok: !gap, siteName: loc.siteName, libraryName: loc.libraryName, siteId: loc.siteId, wider, canWrite,
      message: gap ? `AIC can read ${loc.siteName} but was given read only; the tool is set to write.`
        : `AIC’s agent app can open ${loc.siteName}, library ${loc.libraryName}.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof SharePointError ? e.message : 'Could not reach Microsoft.' };
  }
}
