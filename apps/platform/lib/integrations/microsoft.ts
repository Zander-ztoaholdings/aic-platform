/**
 * Microsoft 365 (Entra ID): AIC's multi-tenant app, admin consent, and the
 * read-only Graph calls the checks need.
 *
 * HOW ACCESS WORKS. A global administrator of the client's tenant grants
 * AIC's Entra app a fixed set of read-only application permissions through
 * Microsoft's admin-consent screen. AIC stores only the tenant id. To read,
 * it asks Microsoft for a one-hour app-only token for that tenant, using
 * AIC's own client secret. The client can remove AIC at any time under
 * Entra ID → Enterprise applications; the next token request then fails and
 * AIC marks the connection disconnected.
 *
 * Application permissions (all read): User.Read.All, AuditLog.Read.All,
 * Policy.Read.All, RoleManagement.Read.Directory, Organization.Read.All.
 * Sign-in activity and MFA registration reports need an Entra ID P1 or P2
 * licence; without one those checks show "could not check".
 *
 * Environment: MS_CLIENT_ID, MS_CLIENT_SECRET. Optional for tests:
 * MS_LOGIN_URL, MS_GRAPH_URL.
 */

const LOGIN = () => (process.env.MS_LOGIN_URL || 'https://login.microsoftonline.com').replace(/\/$/, '');
const GRAPH = () => (process.env.MS_GRAPH_URL || 'https://graph.microsoft.com').replace(/\/$/, '');

export const GLOBAL_ADMIN_TEMPLATE = '62e90394-69f5-4237-9190-012177145e10';

export function microsoftConfigured(): boolean {
  return !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function consentUrl(state: string, redirectUri: string): string {
  const qs = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    scope: 'https://graph.microsoft.com/.default',
    redirect_uri: redirectUri,
    state,
  });
  return `${LOGIN()}/organizations/v2.0/adminconsent?${qs}`;
}

export class MicrosoftError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function tenantToken(tenantId: string): Promise<string> {
  const res = await fetch(`${LOGIN()}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // 400/401 here means consent was withdrawn or never granted for this tenant.
    throw new MicrosoftError(res.status === 400 || res.status === 401 ? 403 : res.status, `Microsoft refused a token for the tenant (${res.status}).`);
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

type Page<T> = { value: T[]; '@odata.nextLink'?: string };

/** All pages of a Graph collection, or null if Graph would not let AIC read it. */
export async function graphList<T>(path: string, token: string, maxPages = 20): Promise<T[] | null> {
  const out: T[] = [];
  let url: string | undefined = `${GRAPH()}${path}`;
  for (let i = 0; url && i < maxPages; i++) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new MicrosoftError(res.status, `Microsoft Graph returned ${res.status} for ${path}`);
    const body = (await res.json()) as Page<T>;
    out.push(...(body.value ?? []));
    url = body['@odata.nextLink'];
  }
  return out;
}

export async function graphGet<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${GRAPH()}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new MicrosoftError(res.status, `Microsoft Graph returned ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export type CaPolicy = {
  displayName: string;
  state: string;
  conditions?: { users?: { includeUsers?: string[]; includeRoles?: string[] } };
  grantControls?: { builtInControls?: string[]; authenticationStrength?: unknown } | null;
};
export type Registration = { userPrincipalName: string; userDisplayName?: string; isAdmin?: boolean; userType?: string; isMfaRegistered?: boolean };
export type DirectoryUser = { userPrincipalName: string; displayName?: string; accountEnabled?: boolean; userType?: string; createdDateTime?: string; signInActivity?: { lastSignInDateTime?: string | null; lastNonInteractiveSignInDateTime?: string | null } | null };

export type TenantFacts = {
  tenantName: string | null;
  securityDefaults: boolean | null;
  caPolicies: CaPolicy[] | null;
  registrations: Registration[] | null;
  globalAdmins: { userPrincipalName?: string; displayName?: string }[] | null;
  users: DirectoryUser[] | null;
};

export async function collectTenantFacts(tenantId: string): Promise<TenantFacts> {
  const token = await tenantToken(tenantId);
  const [org, defaults, ca, reg, admins, users] = await Promise.all([
    graphList<{ displayName?: string }>('/v1.0/organization?$select=displayName', token),
    graphGet<{ isEnabled?: boolean }>('/v1.0/policies/identitySecurityDefaultsEnforcementPolicy', token),
    graphList<CaPolicy>('/v1.0/identity/conditionalAccess/policies', token),
    graphList<Registration>('/v1.0/reports/authenticationMethods/userRegistrationDetails', token),
    graphList<{ userPrincipalName?: string; displayName?: string }>(`/v1.0/directoryRoles(roleTemplateId='${GLOBAL_ADMIN_TEMPLATE}')/members?$select=userPrincipalName,displayName`, token),
    graphList<DirectoryUser>('/v1.0/users?$select=userPrincipalName,displayName,accountEnabled,userType,createdDateTime,signInActivity&$top=999', token),
  ]);
  return {
    tenantName: org?.[0]?.displayName ?? null,
    securityDefaults: typeof defaults?.isEnabled === 'boolean' ? defaults.isEnabled : null,
    caPolicies: ca,
    registrations: reg,
    globalAdmins: admins,
    users,
  };
}
