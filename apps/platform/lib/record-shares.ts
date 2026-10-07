/**
 * Sharing a period of the continuity record with a named person.
 *
 * AIC never hands a client a file with AIC's name on it: a PDF can be edited
 * and passed on, and AIC's name would still be on whatever it became. So a
 * share is a link to the record itself, read live from the platform. "I am
 * me": the link opens only for the person it was made for, after they prove
 * it with a one-time code sent to their own email address. What they see is
 * watermarked with their address and the time, every view is logged for the
 * client to see, and the link expires or can be withdrawn at any time.
 *
 * The token in the link is shown once and stored only as a SHA-256 hash, as
 * are the codes.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { getTenantDb, getSystemDb, recordShares, recordShareCodes, recordShareViews, organizations, users, eq, and, desc, isNull, gte, sql } from '@aic/db';
import { sendEmail } from './email';
import { appUrl } from './app-url';

export const SHARE_LIMITS = { maxDays: 90, codeMinutes: 10, codeAttempts: 5, viewerMinutes: 30, codesPerHour: 5 };
export const SHARE_COOKIE = 'aic_share';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type ShareState = 'open' | 'expired' | 'withdrawn';
export function shareState(s: { expiresAt: Date | string; revokedAt: Date | string | null }, now = new Date()): ShareState {
  if (s.revokedAt) return 'withdrawn';
  return new Date(s.expiresAt).getTime() <= now.getTime() ? 'expired' : 'open';
}

export type ShareInput = { recipientName: string; recipientEmail: string; purpose: string | null; fromDate: string; toDate: string; days: number };

/** Pure: checks what a person asked to share. */
export function validateShare(b: Record<string, unknown>, now = new Date()): { value: ShareInput } | { error: string } {
  const name = typeof b.recipientName === 'string' ? b.recipientName.trim() : '';
  const email = typeof b.recipientEmail === 'string' ? b.recipientEmail.trim().toLowerCase() : '';
  const from = typeof b.fromDate === 'string' ? b.fromDate : '';
  const to = typeof b.toDate === 'string' ? b.toDate : '';
  const days = Number(b.days ?? 14);
  const purpose = typeof b.purpose === 'string' && b.purpose.trim() ? b.purpose.trim().slice(0, 500) : null;
  if (name.length < 2 || name.length > 200) return { error: 'Give the full name of the person you are sharing with.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return { error: 'Give a valid email address. Only the person who can read that inbox will be able to open the record.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Choose the first and last day of the period to share.' };
  if (from > to) return { error: 'The period starts after it ends.' };
  if (to > isoDay(now)) return { error: 'The period cannot end in the future. Share up to today, and share again later if needed.' };
  if (!Number.isInteger(days) || days < 1 || days > SHARE_LIMITS.maxDays) return { error: `A link can stay open for 1 to ${SHARE_LIMITS.maxDays} days.` };
  return { value: { recipientName: name, recipientEmail: email, purpose, fromDate: from, toDate: to, days } };
}

export async function createShare(orgId: string, userId: string, v: ShareInput, now = new Date()): Promise<{ id: string; url: string; emailed: boolean; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + v.days * DAY);
  const [row] = await getTenantDb(orgId).query((tx) =>
    tx.insert(recordShares).values({
      orgId, tokenHash: sha(token), recipientName: v.recipientName, recipientEmail: v.recipientEmail, purpose: v.purpose,
      fromDate: v.fromDate, toDate: v.toDate, expiresAt, createdBy: userId,
    }).returning({ id: recordShares.id }));
  const url = `${appUrl()}/shared/${token}`;

  const db = getSystemDb();
  const [[org], [sender]] = await Promise.all([
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const res = await sendEmail({
    to: v.recipientEmail,
    subject: `${org?.name ?? 'An organisation'} shared its AIC continuity record with you`,
    replyTo: sender?.email,
    paragraphs: [
      `Hello ${v.recipientName.split(' ')[0]},`,
      `${sender?.name ?? 'Someone'} at ${org?.name ?? 'an organisation'} has shared its AIC continuity record for ${fmt(v.fromDate)} to ${fmt(v.toDate)} with you${v.purpose ? `, for: ${v.purpose}` : ''}.`,
      'The record stays on the AIC platform and is read live, so what you see is what AIC holds, with its chain of entries verified. When you open the link, AIC sends a one-time code to this address to confirm it is you.',
      `The link works until ${expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, and only for you. Please do not forward it; ask ${sender?.name?.split(' ')[0] ?? 'the sender'} to share it with anyone else who needs it.`,
    ],
    action: { label: 'Open the record', url },
    footnote: 'AIC does not send copies of a continuity record as files. If someone sends you one that claims to be from AIC, it has not been verified by AIC.',
  });
  return { id: row.id, url, emailed: res.sent, expiresAt };
}

export async function listShares(orgId: string) {
  const db = getTenantDb(orgId);
  return db.query(async (tx) => {
    const rows = await tx.select().from(recordShares).where(eq(recordShares.orgId, orgId)).orderBy(desc(recordShares.createdAt)).limit(100);
    const views = await tx.select({ shareId: recordShareViews.shareId, n: sql<number>`count(*)::int`, last: sql<string>`max(${recordShareViews.viewedAt})` })
      .from(recordShareViews).where(eq(recordShareViews.orgId, orgId)).groupBy(recordShareViews.shareId);
    const byId = new Map(views.map((v) => [v.shareId, v]));
    return rows.map((r) => ({
      id: r.id, recipientName: r.recipientName, recipientEmail: r.recipientEmail, purpose: r.purpose,
      fromDate: r.fromDate, toDate: r.toDate, expiresAt: r.expiresAt, createdAt: r.createdAt,
      state: shareState(r), views: byId.get(r.id)?.n ?? 0, lastViewedAt: byId.get(r.id)?.last ?? null,
    }));
  });
}

export async function withdrawShare(orgId: string, id: string, userId: string): Promise<boolean> {
  const r = await getTenantDb(orgId).query((tx) =>
    tx.update(recordShares).set({ revokedAt: new Date(), revokedBy: userId })
      .where(and(eq(recordShares.id, id), eq(recordShares.orgId, orgId), isNull(recordShares.revokedAt))).returning({ id: recordShares.id }));
  return r.length > 0;
}

/** The share a link points at, with its organisation's name. No session, so read with the platform's own role. */
export async function findShare(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const db = getSystemDb();
  const [s] = await db.select().from(recordShares).where(eq(recordShares.tokenHash, sha(token))).limit(1);
  if (!s) return null;
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  return { ...s, orgName: org?.name ?? 'The organisation', state: shareState(s) };
}

/** "j***@acme.co.za": enough for the right person to recognise, not enough to learn the address. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`;
}

/**
 * Sends a code if, and only if, the address is the one the share was made
 * for. The answer is the same either way, so the page cannot be used to learn
 * who a record was shared with.
 */
export async function requestCode(share: NonNullable<Awaited<ReturnType<typeof findShare>>>, email: string, now = new Date()): Promise<void> {
  if (share.state !== 'open' || email.trim().toLowerCase() !== share.recipientEmail.toLowerCase()) return;
  const db = getSystemDb();
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(recordShareCodes)
    .where(and(eq(recordShareCodes.shareId, share.id), gte(recordShareCodes.createdAt, new Date(now.getTime() - 3_600_000))));
  if ((recent?.n ?? 0) >= SHARE_LIMITS.codesPerHour) return;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(recordShareCodes).values({ shareId: share.id, codeHash: sha(`${share.id}:${code}`), expiresAt: new Date(now.getTime() + SHARE_LIMITS.codeMinutes * 60_000) });
  await sendEmail({
    to: share.recipientEmail,
    subject: `Your code to open ${share.orgName}'s AIC record: ${code}`,
    paragraphs: [
      `Your one-time code is ${code}.`,
      `It works for ${SHARE_LIMITS.codeMinutes} minutes, once. If you did not try to open ${share.orgName}'s continuity record, ignore this email; nobody can open it without this code.`,
    ],
  });
}

/** Checks a code; true once, for the right address, within its time and attempts. */
export async function verifyCode(share: NonNullable<Awaited<ReturnType<typeof findShare>>>, email: string, code: string, now = new Date()): Promise<boolean> {
  if (share.state !== 'open' || email.trim().toLowerCase() !== share.recipientEmail.toLowerCase() || !/^\d{6}$/.test(code.trim())) return false;
  const db = getSystemDb();
  const [c] = await db.select().from(recordShareCodes).where(and(eq(recordShareCodes.shareId, share.id), isNull(recordShareCodes.usedAt)))
    .orderBy(desc(recordShareCodes.createdAt)).limit(1);
  if (!c || new Date(c.expiresAt) <= now || c.attempts >= SHARE_LIMITS.codeAttempts) return false;
  const want = Buffer.from(c.codeHash, 'hex');
  const got = Buffer.from(sha(`${share.id}:${code.trim()}`), 'hex');
  if (!timingSafeEqual(want, got)) {
    await db.update(recordShareCodes).set({ attempts: c.attempts + 1 }).where(eq(recordShareCodes.id, c.id));
    return false;
  }
  await db.update(recordShareCodes).set({ usedAt: now }).where(eq(recordShareCodes.id, c.id));
  return true;
}

// ── The viewer's pass: proof of a verified code, for half an hour ──────────

const secret = () => process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';

export function signViewerPass(shareId: string, email: string, now = Date.now()): string {
  const exp = now + SHARE_LIMITS.viewerMinutes * 60_000;
  const body = `${shareId}.${Buffer.from(email.toLowerCase()).toString('base64url')}.${exp}`;
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}

export function readViewerPass(value: string | undefined, shareId: string, now = Date.now()): string | null {
  if (!value || !secret()) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [id, emailB64, exp, sig] = parts;
  const body = `${id}.${emailB64}.${exp}`;
  const want = createHmac('sha256', secret()).update(body).digest('base64url');
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  if (id !== shareId || Number(exp) < now) return null;
  return Buffer.from(emailB64, 'base64url').toString('utf8');
}

export async function recordView(share: { id: string; orgId: string }, email: string, userAgent: string | null): Promise<void> {
  await getSystemDb().insert(recordShareViews).values({ shareId: share.id, orgId: share.orgId, viewerEmail: email, userAgent: userAgent?.slice(0, 200) ?? null });
}
