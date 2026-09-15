/**
 * The role-based view system.
 *
 * 4-tier model (Zander, 2026-09): AIC SUPER ADMIN > AIC AUDITOR > ORG ADMIN >
 * ORG USER. `users.role` is a single enum spanning both AIC's own staff and
 * a client organisation's staff:
 *
 * - ORG_ADMIN / ORG_USER: a client organisation's own people. Both can
 *   operate the estate day to day - declare and edit systems, submit
 *   evidence, record decisions. Only ORG_ADMIN can invite teammates, manage
 *   API keys/billing, or (see below) is required for the organisation's own
 *   profile fields depending on which endpoint you're in.
 * - AIC_AUDITOR / AIC_SUPER_ADMIN: AIC's own people. Not org members - see
 *   the "what this file does NOT do" note below.
 *
 * REPLACES the old client-only ADMIN / AUDITOR / COMPLIANCE_OFFICER / VIEWER
 * set. This file previously flagged that the codebase had two conflicting
 * ideas of what "AUDITOR" meant: a demo seed script modelled it as an
 * external AIC assessor with no org at all (scripts/seed-demo-org.ts, the
 * 'AIC Assessor (Demo)' user, orgId null); a dated security-fix comment on
 * the AIMS route documented it as an org-level role belonging to the
 * customer's own staff. Zander's 4-tier list resolves that directly:
 * AUDITOR becomes AIC-side (AIC_AUDITOR), which is exactly the demo script's
 * reading, and there is no more org-level "independent reviewer" tier.
 *
 * MAPPING FROM THE OLD MODEL, FOR THE MIGRATION (005_role_tiers.sql):
 *   ADMIN               -> ORG_ADMIN     (unchanged capability)
 *   COMPLIANCE_OFFICER  -> ORG_USER      (unchanged capability - ORG_USER
 *                                         is the new home for "day-to-day
 *                                         working member of the org")
 *   VIEWER              -> ORG_USER      (CAPABILITY CHANGE, FLAGGED: the
 *                                         4-tier model has no read-only org
 *                                         tier. Any existing VIEWER account
 *                                         gains ORG_USER's full mutation
 *                                         rights the moment this runs. If
 *                                         any real client user should stay
 *                                         read-only, say so before running
 *                                         the migration.)
 *   AUDITOR, orgId null  -> AIC_AUDITOR  (the demo script's reading)
 *   AUDITOR, orgId set   -> ORG_USER     (CAPABILITY CHANGE, FLAGGED: loses
 *                                         the old "can record a decision but
 *                                         can't touch the estate" independence
 *                                         property - there's no room for a
 *                                         distinct org-side reviewer tier in
 *                                         a 4-tier model. Only matters if a
 *                                         real client user actually holds
 *                                         this combination today.)
 *   isSuperAdmin = true  -> AIC_SUPER_ADMIN (label kept in sync; the boolean
 *                                         stays the actual security gate,
 *                                         see below)
 *
 * WHAT THIS FILE DOES NOT DO: it does not become the access gate for AIC
 * staff actions. That boundary is deliberately kept on `lib/rbac.ts`
 * (`hasCapability`) and the `isSuperAdmin` boolean, exactly as before this
 * change - see the AIMS route comment (app/api/v1/aims/[orgId]) for why:
 * that file documents a real, previously-shipped bug where an org's own
 * ADMIN could satisfy a check meant for AIC staff, because both were, at the
 * time, compared against the same loosely-typed field. Adding AIC_SUPER_ADMIN
 * / AIC_AUDITOR as `role` values makes that same mistake easy to make again
 * if a security-sensitive AIC-staff check is ever written as
 * `role === 'AIC_SUPER_ADMIN'` alone - it should instead check `isSuperAdmin`
 * (or `hasCapability`), with `role` used only for coarse, low-stakes
 * purposes: which sidebar a person sees, how their name badge reads, and
 * (this file's actual job) what a client-organisation member can do inside
 * their own org.
 */

export type OrgRole = 'AIC_SUPER_ADMIN' | 'AIC_AUDITOR' | 'ORG_ADMIN' | 'ORG_USER';

type MaybeRole = OrgRole | string | null | undefined;

function is(role: MaybeRole, ...allowed: OrgRole[]): boolean {
  return !!role && (allowed as string[]).includes(role);
}

/**
 * True for a role that cannot mutate anything in a client organisation's own
 * portal. In practice this is now only true for a role that isn't an org
 * member at all (AIC_SUPER_ADMIN, AIC_AUDITOR, or anything unrecognised) -
 * the 4-tier model has no read-only org-side tier. AIC staff aren't
 * structurally meant to be viewing a client's own portal through this role
 * field in the first place (see the file header); this fails closed for
 * them here rather than assuming.
 */
export function isReadOnly(role: MaybeRole): boolean {
  return !is(role, 'ORG_ADMIN', 'ORG_USER');
}

/** Declare, edit or promote an AI system; edit the governance workspace. */
export function canManageEstate(role: MaybeRole): boolean {
  return is(role, 'ORG_ADMIN', 'ORG_USER');
}

/** Submit evidence, respond to a finding, resolve an incident or correction. */
export function canManageCompliance(role: MaybeRole): boolean {
  return is(role, 'ORG_ADMIN', 'ORG_USER');
}

/** Record a decision, or attest to / record a human override. */
export function canRecordDecisions(role: MaybeRole): boolean {
  return is(role, 'ORG_ADMIN', 'ORG_USER');
}

/** Edit the organisation's own profile fields (name, contact email, ...). */
export function canEditOrgProfile(role: MaybeRole): boolean {
  return is(role, 'ORG_ADMIN', 'ORG_USER');
}

/** Invite teammates, manage API keys, manage billing. Admin only. */
export function canManageTeamAndKeys(role: MaybeRole): boolean {
  return is(role, 'ORG_ADMIN');
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  AIC_SUPER_ADMIN: 'AIC Super Admin',
  AIC_AUDITOR: 'AIC Auditor',
  ORG_ADMIN: 'Organisation Admin',
  ORG_USER: 'Organisation User',
};
