/**
 * "View as": a super admin previews the platform as another role sees it.
 *
 * The preview is a cookie read on the server. It is honoured only when the
 * real session belongs to a super admin, and it can only ever reduce what that
 * person can see or do: the roles below all sit beneath super admin. While it
 * is set, the middleware refuses every write to the API, so a preview cannot
 * change anything, under the previewed role or the real one.
 */

export const VIEW_AS_COOKIE = 'aic_view_as';
export const VIEW_AS_ROLES = ['ORG_ADMIN', 'ORG_USER', 'AIC_AUDITOR'] as const;
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number];

export interface ViewAs {
  role: ViewAsRole;
  /** Required for the client roles; null for AIC_AUDITOR. */
  orgId: string | null;
  orgName: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClientRole(role: ViewAsRole): boolean {
  return role === 'ORG_ADMIN' || role === 'ORG_USER';
}

export function parseViewAs(raw: string | null | undefined): ViewAs | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ViewAs>;
    if (!v || !VIEW_AS_ROLES.includes(v.role as ViewAsRole)) return null;
    const role = v.role as ViewAsRole;
    if (isClientRole(role)) {
      if (typeof v.orgId !== 'string' || !UUID.test(v.orgId)) return null;
      return { role, orgId: v.orgId, orgName: typeof v.orgName === 'string' ? v.orgName.slice(0, 200) : null };
    }
    return { role, orgId: null, orgName: null };
  } catch {
    return null;
  }
}

export function serializeViewAs(v: ViewAs): string {
  return encodeURIComponent(JSON.stringify(v));
}

/** The preview cookie on the current request, or null outside a request. */
export async function readViewAsCookie(): Promise<ViewAs | null> {
  try {
    const { cookies } = await import('next/headers');
    return parseViewAs((await cookies()).get(VIEW_AS_COOKIE)?.value);
  } catch {
    return null;
  }
}
