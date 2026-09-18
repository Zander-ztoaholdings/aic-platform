import type { OrgRole } from './roles';

/**
 * The canonical capability set, and which role holds which.
 *
 * WHY THIS FILE EXISTS.
 *
 * Authorisation used to resolve exclusively through the database:
 * `hasCapability()` looked up a slug in `capabilities`, then looked for a row
 * in `role_capabilities` matching `users.role_id`. Both of those are empty.
 * Nothing in this repository — not signup, not the invite flow, not the
 * onboard route, not a seed, not a script — ever writes `users.role_id`. The
 * effect was that every capability check in the application resolved to
 * `false` for every account except a super-admin, permanently. That fails
 * closed, which is the right direction to fail, but it is not access control:
 * it is a single boolean wearing the costume of a role model, and it means an
 * AIC auditor hired tomorrow can do nothing at all.
 *
 * The matrix below is the fix. It is defined in code rather than data because
 * a certification body has to be able to show an assessor what its
 * authorisation model is, demonstrate that it is reviewed when it changes, and
 * prove it with tests. A row in a table nobody seeded can do none of that. The
 * database path is kept underneath this for per-user exceptions and for
 * admin-managed roles later; it is now a supplement, not the foundation.
 *
 * SEPARATION OF DUTIES.
 *
 * The split between AIC_AUDITOR and super-admin is not arbitrary tiering. A
 * certification body must not let the person who performed the evaluation also
 * make the certification decision — that independence is the thing a
 * certificate actually asserts. So `conduct_assessment` sits with the auditor,
 * while `approve_certification`, `issue_certification` and
 * `manage_certification_lifecycle` do not, and neither does
 * `clear_impartiality_conflict`: an assessor clearing their own declared
 * conflict is precisely the failure that control exists to prevent.
 *
 * ROLE IS NOT THE GATE FOR AIC-STAFF POWER.
 *
 * lib/roles.ts's header and the admin user-creation route both state the rule:
 * `users.role` is a label, `users.isSuperAdmin` is the gate, and a
 * security-sensitive AIC-staff check must never be `role === 'AIC_SUPER_ADMIN'`
 * alone. This file honours that. The AIC_SUPER_ADMIN *role* is granted exactly
 * the same set as AIC_AUDITOR here; everything above that line is reached only
 * through the `isSuperAdmin` boolean, which `/api/v1/admin/users` keeps in sync
 * when it creates such an account. Holding the label is not holding the power.
 */

export const CAPABILITIES = {
  access_admin_tools: 'Reach platform administration tooling and the RBAC editor.',
  access_hq: 'Reach institutional HQ metrics.',
  access_internal_tools: 'Reach internal operations tooling.',
  approve_certification: 'Approve a certification decision.',
  clear_impartiality_conflict: 'Clear a declared impartiality conflict on an assessment.',
  conduct_assessment: 'Perform an assessment: raise findings, record corrective actions, work an AIMS file.',
  issue_certification: 'Issue a certificate and publish the organisation to the public register.',
  manage_certification_lifecycle: 'Suspend, revoke or reinstate an issued certificate.',
  manage_content: 'Publish or edit public website content and subscriber lists.',
  manage_roles: 'Create or alter roles and their capability grants.',
  manage_users: 'Create, alter or deactivate user accounts across organisations.',
  upload_bias_report: 'Upload a bias report against the organisation’s own file.',
  view_all_orgs: 'List and read organisations other than your own.',
  view_revenue: 'Read commercial and revenue figures.',
} as const;

/**
 * Every slug in the system. Typing the argument to `hasCapability` against this
 * matters more than it looks: before this, a misspelled slug compiled happily
 * and then denied everybody forever, silently, because the lookup simply found
 * no such capability row. Now it fails the build.
 */
export type Capability = keyof typeof CAPABILITIES;

export const ALL_CAPABILITIES = Object.keys(CAPABILITIES) as Capability[];

/**
 * What each role holds on the strength of the role alone.
 *
 * Deliberately conservative. Anything absent here is reachable only by the
 * `isSuperAdmin` boolean or by an explicit per-user grant recorded in
 * `user_capabilities`, which leaves an auditable row behind naming who was
 * given what.
 */
export const ROLE_CAPABILITIES: Record<OrgRole, readonly Capability[]> = {
  // The label, not the power. See the file header: everything a super admin
  // can do above this line is gated on users.isSuperAdmin, not on this row.
  AIC_SUPER_ADMIN: ['conduct_assessment', 'view_all_orgs', 'access_internal_tools'],

  // Evaluation work, and nothing that decides an outcome.
  //
  // `view_all_orgs` is broader than it should eventually be: an auditor can
  // currently read every organisation rather than only the ones they are
  // assigned to. Narrowing that needs an assignment model (organizations
  // already carries auditorId, so the data is there) and is worth doing before
  // there is a second auditor on staff.
  AIC_AUDITOR: ['conduct_assessment', 'view_all_orgs', 'access_internal_tools'],

  // A client organisation's own people hold no AIC-staff capability. What they
  // may do inside their own organisation is decided by lib/roles.ts, which is
  // a separate model over session role and needs no database lookup.
  ORG_ADMIN: ['upload_bias_report'],
  ORG_USER: ['upload_bias_report'],
};

/**
 * Does this role, on its own, hold this capability?
 *
 * Pure and synchronous on purpose — it is the part of authorisation that can be
 * unit tested without a database, which is what makes the model demonstrable
 * rather than merely asserted.
 */
export function roleHasCapability(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  const granted = ROLE_CAPABILITIES[role as OrgRole];
  if (!granted) return false;
  return granted.includes(capability);
}

/**
 * Capabilities no role grants by itself — reachable only through
 * `isSuperAdmin`, or an explicit per-user grant. Exported so a test can assert
 * the separation rather than trusting the table above to stay honest.
 */
export const SUPER_ADMIN_ONLY: readonly Capability[] = ALL_CAPABILITIES.filter(
  (c) => !Object.values(ROLE_CAPABILITIES).some((list) => list.includes(c))
);
