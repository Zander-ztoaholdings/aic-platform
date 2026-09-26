import { roleHasCapability, type Capability } from './capabilities';

/**
 * Which workspace a signed-in person belongs in, and which paths they may open.
 *
 * WHY THIS EXISTS.
 *
 * Until now every sign-in — credentials or SSO, client or AIC staff — was sent
 * to `/`, the client workspace. An AIC auditor has no organisation, so they
 * landed on a dashboard whose every request needs one, and saw a page of
 * errors. The staff areas (/admin, /hq) had no gate of their own at all: any
 * signed-in client could open /admin/users or /hq/growth/revenue and be shown
 * the staff console, its navigation and what AIC's internal tools are called.
 * The APIs behind them refused the data, but the interface itself leaked the
 * shape of the business and told clients these doors existed.
 *
 * This file is the single answer to "where does this person go and what may
 * they open", used by the post-login router, the server-side layout gates and
 * the navigation. It is pure so it can be tested without a session or a
 * database, and it follows the rule lib/roles.ts sets down: the isSuperAdmin
 * boolean is the gate for AIC-staff power, and `role` alone never is.
 */

export interface WorkspaceUser {
  role?: string | null;
  isSuperAdmin?: boolean | null;
  orgId?: string | null;
}

export type Workspace = 'client' | 'staff';

const STAFF_ROLES = new Set(['AIC_SUPER_ADMIN', 'AIC_AUDITOR']);

/** AIC's own people: the boolean, or a staff role. */
export function isStaff(user: WorkspaceUser | null | undefined): boolean {
  if (!user) return false;
  return user.isSuperAdmin === true || STAFF_ROLES.has(user.role ?? '');
}

/**
 * The client workspace is scoped to an organisation, so it needs one. A staff
 * member who happens to carry an orgId can open it; the write guards in
 * lib/guard.ts still refuse them, so what they get is a read-only view — which
 * is the right thing for an assessor looking at a client's own screen.
 */
export function canUseClientWorkspace(user: WorkspaceUser | null | undefined): boolean {
  return !!user && typeof user.orgId === 'string' && user.orgId.length > 0;
}

/** /admin — assessment and register work. */
export function canUseStaffWorkspace(user: WorkspaceUser | null | undefined): boolean {
  return isStaff(user);
}

/**
 * /hq — revenue, people, CMS, company governance. The boolean only: an auditor
 * assesses clients; they do not read AIC's revenue or HR records.
 */
export function canUseHq(user: WorkspaceUser | null | undefined): boolean {
  return !!user && user.isSuperAdmin === true;
}

/**
 * Visibility of a staff navigation item. Mirrors lib/rbac.ts's resolution
 * without the database (no per-user overrides), so it can only ever hide
 * something the server would have allowed, never show something it refuses —
 * and the server re-checks every request regardless.
 */
export function staffCan(user: WorkspaceUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  return roleHasCapability(user.role, capability);
}

/** Where someone goes when there is nowhere more specific to send them. */
export function homeFor(user: WorkspaceUser | null | undefined): string {
  if (!user) return '/login';
  if (isStaff(user)) return '/admin';
  if (canUseClientWorkspace(user)) return '/';
  // Signed in, but neither staff nor a member of an organisation — an account
  // whose organisation was removed, say. There is no workspace to show them.
  return '/unauthorized';
}

const NEVER_A_LANDING = ['/api', '/login', '/start', '/signup', '/onboard', '/mfa'];

/**
 * A `next` value is only honoured if it is a path on this site. Anything with
 * a scheme, a protocol-relative `//host`, a backslash (which some browsers read
 * as a slash) or pointing at the auth pages is dropped — otherwise the sign-in
 * page becomes an open redirect that sends a freshly-authenticated person to
 * whatever site the link's author chose.
 */
export function safePath(next: string | null | undefined): string | null {
  if (!next || typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  // Raw control characters (CR/LF in particular) never belong in a path.
  if ([...next].some((ch) => ch.charCodeAt(0) < 0x20)) return null;
  const pathOnly = next.split(/[?#]/)[0];
  if (NEVER_A_LANDING.some((p) => pathOnly === p || pathOnly.startsWith(p + '/'))) return null;
  return next;
}

/** May this person open this path at all? */
export function canEnter(path: string, user: WorkspaceUser | null | undefined): boolean {
  const p = path.split(/[?#]/)[0];
  if (p === '/hq' || p.startsWith('/hq/')) return canUseHq(user);
  if (p === '/admin' || p.startsWith('/admin/')) return canUseStaffWorkspace(user);
  return canUseClientWorkspace(user);
}

/**
 * Where to send someone who has just signed in: the page they were trying to
 * reach, if it is safe and they may open it; otherwise their home.
 */
export function resolveLanding(user: WorkspaceUser | null | undefined, next?: string | null): string {
  const target = safePath(next);
  if (target && canEnter(target, user)) return target;
  return homeFor(user);
}
