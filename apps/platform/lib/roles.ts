/**
 * The role-based view system.
 *
 * One place decides what each of the four org-level roles
 * (users.role: ADMIN / AUDITOR / COMPLIANCE_OFFICER / VIEWER) can see and do
 * across the client portal, so a page asks "canManageEstate(role)" instead of
 * re-deriving the same role list inline in a dozen files. This is deliberately
 * NOT the same system as `lib/rbac.ts` (`hasCapability`), which is a separate,
 * unseeded, granular permissions table for AIC's own internal staff tooling
 * ((modules)/admin, (modules)/hq). Client organisations are governed by this
 * file and only this file - see the AIMS route comment (app/api/v1/aims/[orgId])
 * for the canonical statement of that boundary.
 *
 * The model, in one sentence each:
 *
 * - VIEWER never mutates anything. They see every screen, exactly as an
 *   ADMIN would, with every control that changes state removed or disabled.
 * - COMPLIANCE_OFFICER runs the day-to-day estate: declares systems, edits
 *   the governance workspace, submits evidence, records decisions and
 *   overrides, resolves incidents and correction requests. They cannot touch
 *   who is on the team, API keys, billing, or the organisation's own profile.
 * - AUDITOR is the org's own independent reviewer - not an AIC assessor
 *   (those exist entirely outside this enum; see the AIMS route comment).
 *   They can see everything COMPLIANCE_OFFICER can, and can record a
 *   decision or attest to one, but cannot change the estate itself - no
 *   declaring or editing systems, no submitting evidence on the org's
 *   behalf. An independent reviewer who could also edit what they're
 *   reviewing would not be independent.
 * - ADMIN can do everything COMPLIANCE_OFFICER can, plus team invites, API
 *   keys, billing, and the organisation profile.
 *
 * JUDGEMENT CALL, FLAGGED: the codebase has two pieces of directly
 * conflicting evidence for what AUDITOR means (a demo seed script models it
 * as an external AIC assessor with no org at all; a dated security-fix
 * comment on the AIMS route documents it as an org-level role belonging to
 * the customer's own staff). This file follows the documented, *secured*
 * interpretation, because that is the one every existing backend check
 * already assumes. Worth confirming this is the intended model before it
 * goes in front of a client.
 */

export type OrgRole = 'ADMIN' | 'AUDITOR' | 'COMPLIANCE_OFFICER' | 'VIEWER';

type MaybeRole = OrgRole | string | null | undefined;

function is(role: MaybeRole, ...allowed: OrgRole[]): boolean {
  return !!role && (allowed as string[]).includes(role);
}

/** True for a role that cannot mutate anything, anywhere. */
export function isReadOnly(role: MaybeRole): boolean {
  return !is(role, 'ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER');
}

/** Declare, edit or promote an AI system; edit the governance workspace. */
export function canManageEstate(role: MaybeRole): boolean {
  return is(role, 'ADMIN', 'COMPLIANCE_OFFICER');
}

/** Submit evidence, respond to a finding, resolve an incident or correction. */
export function canManageCompliance(role: MaybeRole): boolean {
  return is(role, 'ADMIN', 'COMPLIANCE_OFFICER');
}

/** Record a decision, or attest to / record a human override. */
export function canRecordDecisions(role: MaybeRole): boolean {
  return is(role, 'ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR');
}

/** Edit the organisation's own profile fields (name, contact email, ...). */
export function canEditOrgProfile(role: MaybeRole): boolean {
  return is(role, 'ADMIN', 'COMPLIANCE_OFFICER');
}

/** Invite teammates, manage API keys, manage billing. Admin only. */
export function canManageTeamAndKeys(role: MaybeRole): boolean {
  return is(role, 'ADMIN');
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  ADMIN: 'Administrator',
  COMPLIANCE_OFFICER: 'Compliance Officer',
  AUDITOR: 'Auditor',
  VIEWER: 'Viewer',
};
