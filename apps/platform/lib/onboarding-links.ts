/**
 * Client onboarding links: what AIC staff send a prospective client to start.
 *
 * The link opens /join/<token>: a short welcome, then the registration wizard
 * with the organisation and contact filled in. When the client registers,
 * the link is used up and the organisation gets its AIC lead (the one chosen
 * on the link when they may hold the file, otherwise the default rule in
 * lib/assignments.ts). Registration itself is public; the link only carries
 * the prefill and the assignment.
 */
import { randomBytes } from 'crypto';
import { getSystemDb, clientOnboardingLinks, users, eq, desc, sql } from '@aic/db';

export const LINK_DAYS = { min: 1, max: 90, default: 14 } as const;

export type LinkState = 'open' | 'used' | 'expired' | 'revoked';

/** Pure: where a link stands. */
export function linkState(l: { revokedAt: Date | string | null; expiresAt: Date | string; uses: number; maxUses: number }, now = new Date()): LinkState {
  if (l.revokedAt) return 'revoked';
  if (l.uses >= l.maxUses) return 'used';
  if (new Date(l.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'open';
}

export const LINK_STATE_LABEL: Record<LinkState, string> = { open: 'Waiting for the client', used: 'Used', expired: 'Expired', revoked: 'Withdrawn' };

export const newToken = () => randomBytes(24).toString('base64url');
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

/** Pure: validates what staff typed. */
export function cleanLinkInput(b: Record<string, unknown>): { value: { orgName: string | null; contactName: string | null; contactEmail: string | null; preferredLeadId: string | null; note: string | null; days: number; maxUses: number } } | { error: string } {
  const contactEmail = str(b.contactEmail, 255);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { error: 'That email address does not look right.' };
  const days = Math.round(Number(b.days ?? LINK_DAYS.default));
  if (!Number.isFinite(days) || days < LINK_DAYS.min || days > LINK_DAYS.max) return { error: `A link can last from ${LINK_DAYS.min} to ${LINK_DAYS.max} days.` };
  const maxUses = Math.round(Number(b.maxUses ?? 1));
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100) return { error: 'A link can be used from 1 to 100 times.' };
  const lead = typeof b.preferredLeadId === 'string' && /^[0-9a-f-]{36}$/i.test(b.preferredLeadId) ? b.preferredLeadId : null;
  return { value: { orgName: str(b.orgName, 200), contactName: str(b.contactName, 200), contactEmail: contactEmail?.toLowerCase() ?? null, preferredLeadId: lead, note: str(b.note, 1000), days, maxUses } };
}

export async function findLink(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  try {
    const [l] = await getSystemDb().select().from(clientOnboardingLinks).where(eq(clientOnboardingLinks.token, token)).limit(1);
    return l ?? null;
  } catch { return null; }
}

/** What the public welcome page and the wizard may know about a link. Never who created it or who the lead is. */
export async function publicLink(token: string) {
  const l = await findLink(token);
  if (!l) return null;
  return { state: linkState(l), orgName: l.orgName, contactName: l.contactName, contactEmail: l.contactEmail, expiresAt: l.expiresAt };
}

export async function listLinks() {
  const rows = await getSystemDb().select({ l: clientOnboardingLinks, lead: users.name })
    .from(clientOnboardingLinks).leftJoin(users, eq(users.id, clientOnboardingLinks.preferredLeadId))
    .orderBy(desc(clientOnboardingLinks.createdAt)).limit(200);
  return rows.map(({ l, lead }) => ({ ...l, leadName: lead, state: linkState(l) }));
}

/**
 * Called after a registration that came through a link. Uses the link up and
 * assigns the lead. Never throws: a registration must not fail because of it.
 */
export async function consumeLinkOnSignup(token: string | null | undefined, orgId: string): Promise<void> {
  if (!token) return;
  try {
    const l = await findLink(token);
    if (!l || linkState(l) !== 'open') return;
    // Count the use atomically, so two registrations cannot both use a single-use link.
    const updated = await getSystemDb().update(clientOnboardingLinks)
      .set({ uses: sql`${clientOnboardingLinks.uses} + 1`, usedOrgIds: sql`array_append(${clientOnboardingLinks.usedOrgIds}, ${orgId}::uuid)`, lastUsedAt: new Date() })
      .where(sql`${clientOnboardingLinks.id} = ${l.id} AND ${clientOnboardingLinks.uses} < ${clientOnboardingLinks.maxUses} AND ${clientOnboardingLinks.revokedAt} IS NULL`)
      .returning({ id: clientOnboardingLinks.id });
    if (!updated.length) return;
    const { assignOnSignup } = await import('./assignments');
    await assignOnSignup(orgId, l.preferredLeadId);
  } catch (e) {
    console.error('[ONBOARDING_LINK] could not use link:', (e as Error).message);
  }
}
