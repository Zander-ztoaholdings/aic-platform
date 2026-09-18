import { NextResponse } from 'next/server';
import type { OrgRole } from './roles';

type MaybeRole = OrgRole | string | null | undefined;

/**
 * The client-side authorisation guard: may this session mutate this
 * organisation's record?
 *
 * WHY THIS EXISTS.
 *
 * Thirty-four API routes checked only that somebody was signed in. For a read
 * that is defensible — `getTenantDb()` scopes the query to the caller's own
 * organisation. For a write it is not. Nothing stopped an AIC auditor, who is
 * not a member of the organisation at all, from amending the evidence they were
 * in the middle of assessing, and nothing recorded a refusal if they tried.
 *
 * WHY IT TAKES THE PREDICATE RATHER THAN CHECKING FOR ITSELF.
 *
 * lib/roles.ts's four predicates all return the same answer today, because the
 * 4-tier model gives ORG_ADMIN and ORG_USER identical rights inside their own
 * organisation and gives AIC staff none. Collapsing them into one generic
 * "can this person write" check would work, and would quietly lose the reason
 * each route is guarded. Naming the predicate keeps the intent in the call
 * site, so that the day a read-only org tier is reintroduced — or
 * canManageTeamAndKeys starts differing from canManageEstate, which it already
 * does — the routes already say which question they were asking.
 *
 * `action` is written to be read by the person refused, not by the developer:
 * "Your role may not submit evidence in this organisation" tells them what to
 * do next; "Forbidden" does not.
 */
export function requireOrgCapability(
  role: MaybeRole,
  allows: (role: MaybeRole) => boolean,
  action: string
): NextResponse | null {
  if (allows(role)) return null;

  console.warn(`[AUTHZ] refused role=${role ?? 'none'} action="${action}"`);

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: `Your role may not ${action} in this organisation.`,
    },
    { status: 403 }
  );
}

/**
 * The organisation a caller is acting inside, or a 401.
 *
 * A handful of routes reached `getTenantDb(session.user.orgId as string)` with
 * no check that orgId was there — the cast made it compile, and getTenantDb's
 * own guard turned it into a 500 at runtime. An AIC auditor, who legitimately
 * has no orgId, could trip that just by opening the wrong page. A 401 saying
 * the session is not a member of an organisation is the honest answer.
 */
export function requireOrgId(orgId: unknown): { orgId: string } | NextResponse {
  if (typeof orgId === 'string' && orgId.length > 0) return { orgId };
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: 'This session is not a member of an organisation.',
    },
    { status: 401 }
  );
}
