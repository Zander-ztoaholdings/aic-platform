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
import { getSystemDb, clientOnboardingLinks, clientOnboardingLinkEmails, users, eq, desc, inArray, sql } from '@aic/db';
import { sendEmail } from './email';
import { appUrl } from './app-url';

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
  const emails = await emailHistory(rows.map((r) => r.l.id));
  return rows.map(({ l, lead }) => {
    const sent = emails.get(l.id) ?? [];
    const last = sent.find((e) => e.accepted) ?? null;
    return { ...l, leadName: lead, state: linkState(l), emailedAt: last?.sentAt ?? null, emailCount: sent.filter((e) => e.accepted).length, emailBlocked: canEmail(l, sent) };
  });
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

// ── Sending the link by email ─────────────────────────────────────────────────

export const MAX_EMAILS_PER_LINK = 5;
export const RESEND_GAP_MS = 10 * 60_000;

type LinkRow = typeof clientOnboardingLinks.$inferSelect;
type Sender = { name: string | null; email: string | null };

/** Pure: the email a client receives. It says who sent it and how to check it is genuine. */
export function linkEmail(l: Pick<LinkRow, 'token' | 'orgName' | 'contactName' | 'expiresAt'>, sender: Sender, base = appUrl()) {
  const first = l.contactName?.trim().split(/\s+/)[0];
  const who = sender.name?.trim() || 'Your contact at AIC';
  const org = l.orgName?.trim();
  const until = new Date(l.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' });
  const host = new URL(base).host;
  return {
    subject: org ? `Start ${org}'s onboarding with AIC` : 'Start your onboarding with AIC',
    paragraphs: [
      `Hello${first ? ` ${first}` : ''},`,
      `${who} at AI Integrity Certification (AIC) has set up onboarding for ${org ?? 'your organisation'}. Registering takes about ten minutes. A guide then walks you through setting up your workspace, and your AIC assessor is assigned as soon as you register.`,
      `To check this email is genuine: it comes from aiccertified.cloud and the button below opens ${host}.${sender.email ? ` You can reply to this email to reach ${sender.name?.trim() ? sender.name.trim().split(/\s+/)[0] : 'us'} directly.` : ''} AIC never asks for a password, a one-time code or payment details by email.`,
    ],
    action: { label: 'Start onboarding', url: `${base}/join/${l.token}` },
    footnote: `This link is for ${org ?? 'your organisation'} and works until ${until}. If you were not expecting it, you can ignore this email.`,
  };
}

/** Pure: whether a link may be emailed now, and why not. */
export function canEmail(l: Pick<LinkRow, 'contactEmail' | 'revokedAt' | 'expiresAt' | 'uses' | 'maxUses'>, sent: { sentAt: Date | string; accepted: boolean }[], now = new Date()): string | null {
  if (!l.contactEmail) return 'Add the contact’s email address to the link first.';
  if (linkState(l, now) !== 'open') return 'Only a link that is still open can be emailed.';
  const ok = sent.filter((e) => e.accepted);
  if (ok.length >= MAX_EMAILS_PER_LINK) return `It has already been emailed ${MAX_EMAILS_PER_LINK} times. Make a new link if it is still needed.`;
  const last = ok.map((e) => new Date(e.sentAt).getTime()).sort((a, b) => b - a)[0];
  if (last && now.getTime() - last < RESEND_GAP_MS) return 'It was emailed a few minutes ago. Give it ten minutes before sending again.';
  return null;
}

async function emailsFor(linkIds: string[]) {
  if (!linkIds.length) return [];
  try {
    return await getSystemDb().select().from(clientOnboardingLinkEmails).where(inArray(clientOnboardingLinkEmails.linkId, linkIds)).orderBy(desc(clientOnboardingLinkEmails.sentAt));
  } catch { return []; } // 019 not applied: no history yet
}

export async function emailHistory(linkIds: string[]) {
  const rows = await emailsFor(linkIds);
  const out = new Map<string, { sentAt: Date; accepted: boolean; sentTo: string }[]>();
  for (const r of rows) out.set(r.linkId, [...(out.get(r.linkId) ?? []), { sentAt: r.sentAt, accepted: r.accepted, sentTo: r.sentTo }]);
  return out;
}

/** Emails the link to its contact from AIC, with replies going to the staff member. */
export async function emailLink(linkId: string, senderId: string): Promise<{ sent: true; to: string } | { sent: false; reason: string }> {
  const db = getSystemDb();
  const [l] = await db.select().from(clientOnboardingLinks).where(eq(clientOnboardingLinks.id, linkId)).limit(1);
  if (!l) return { sent: false, reason: 'Not found' };
  const history = (await emailHistory([l.id])).get(l.id) ?? [];
  const refused = canEmail(l, history);
  if (refused) return { sent: false, reason: refused };
  const [me] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, senderId)).limit(1);
  const replyTo = me?.email && !/@(removed\.invalid|aic\.test)$/i.test(me.email) ? me.email : undefined;
  const msg = linkEmail(l, { name: me?.name ?? null, email: replyTo ?? null });
  const res = await sendEmail({ to: l.contactEmail!, ...msg, replyTo });
  try {
    await db.insert(clientOnboardingLinkEmails).values({ linkId: l.id, sentTo: l.contactEmail!, sentBy: senderId, accepted: res.sent, failure: res.sent ? null : res.reason ?? 'unknown' });
  } catch { /* 019 not applied: the email still went */ }
  if (!res.sent) return { sent: false, reason: res.reason === 'not-configured' ? 'Email is not switched on for this AIC server (RESEND_API_KEY), so nothing was sent. Copy the link instead.' : 'The mail service refused it. Check the address, or copy the link instead.' };
  return { sent: true, to: l.contactEmail! };
}
