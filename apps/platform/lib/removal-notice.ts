/**
 * Closing the loop when AIC removes an organisation or an account.
 *
 * The people affected are told by email: what was removed, when, the reason
 * recorded, and the named AIC person who made the decision. They can
 * challenge it by replying (replies go to that person) or with the button,
 * quoting a reference that matches the oversight record. A removal nobody is
 * told about cannot be challenged, and a challenge without a named person to
 * answer it goes nowhere; AIC certifies exactly that for its clients' own
 * automated decisions, so it holds itself to the same.
 *
 * Recipients are read BEFORE the removal: removing an account erases its
 * email address. Sending never blocks or undoes the removal; a failed send is
 * logged and reported back to the admin.
 */
import { getSystemDb, users, organizations, eq } from '@aic/db';
import { sendEmail } from './email';

export type Recipient = { email: string; name: string | null };
export type Actor = { name: string; email: string; role: string };

const CHALLENGE_DAYS = 30;
const isReal = (email: string | null | undefined): email is string => !!email && /@/.test(email) && !email.endsWith('@removed.invalid');

/** Who made the decision, as the email names them. */
export async function actorFor(actorId: string): Promise<Actor> {
  const [u] = await getSystemDb().select({ name: users.name, email: users.email, isSuperAdmin: users.isSuperAdmin, role: users.role }).from(users).where(eq(users.id, actorId)).limit(1);
  return {
    name: u?.name?.trim() || 'An AIC administrator',
    email: u?.email ?? '',
    role: u?.isSuperAdmin || u?.role === 'AIC_SUPER_ADMIN' ? 'AIC administrator' : u?.role === 'AIC_AUDITOR' ? 'AIC assessor' : 'AIC staff',
  };
}

/** Everyone to tell about an organisation's removal: its members (not AIC staff, not the actor) and its contact address. */
export async function orgRecipients(orgId: string, actorId: string): Promise<{ orgName: string; recipients: Recipient[] }> {
  const db = getSystemDb();
  const [org] = await db.select({ name: organizations.name, contactEmail: organizations.contactEmail }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const members = await db.select({ id: users.id, email: users.email, name: users.name, isSuperAdmin: users.isSuperAdmin, role: users.role }).from(users).where(eq(users.orgId, orgId));
  const list: Recipient[] = members
    .filter((m) => m.id !== actorId && !m.isSuperAdmin && m.role !== 'AIC_SUPER_ADMIN' && m.role !== 'AIC_AUDITOR' && isReal(m.email))
    .map((m) => ({ email: m.email.toLowerCase(), name: m.name }));
  if (isReal(org?.contactEmail) && !list.some((r) => r.email === org!.contactEmail!.toLowerCase())) list.push({ email: org!.contactEmail!.toLowerCase(), name: null });
  return { orgName: org?.name ?? 'your organisation', recipients: list };
}

export const removalReference = (kind: 'organisation' | 'account', id: string) => `AIC-${kind === 'organisation' ? 'ORG' : 'ACC'}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/** The email itself. Pure, for tests. */
export function removalEmail(input: { kind: 'organisation' | 'account'; subjectName: string; recipient: Recipient; actor: Actor; reason: string; reference: string; when: Date }) {
  const { kind, subjectName, recipient, actor, reason, reference, when } = input;
  const date = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' });
  const what = kind === 'organisation' ? `${subjectName} has been removed from AIC` : 'Your AIC account has been removed';
  const challengeBy = new Date(when.getTime() + CHALLENGE_DAYS * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' });
  const subject = encodeURIComponent(`Challenge to removal ${reference}`);
  return {
    to: recipient.email,
    subject: `${what} (${reference})`,
    replyTo: actor.email || undefined,
    paragraphs: [
      `Hello${recipient.name ? ` ${recipient.name.split(' ')[0]}` : ''},`,
      kind === 'organisation'
        ? `On ${date}, ${subjectName} and its workspace were removed from the AIC platform. You can no longer sign in to it.`
        : `On ${date}, your account${subjectName ? ` (${subjectName})` : ''} was removed from the AIC platform. You can no longer sign in with it.`,
      `The reason recorded: ${reason.trim()}`,
      `The person responsible for this decision is ${actor.name}, ${actor.role}.${actor.email ? ` You can reach them at ${actor.email}.` : ''}`,
      `If you think this is wrong, you can challenge it until ${challengeBy}. Reply to this email, or use the button below, and quote reference ${reference}. ${actor.name.split(' ')[0]} must answer, and the challenge and its outcome are kept on AIC's oversight record.`,
    ],
    action: actor.email ? { label: 'Challenge this decision', url: `mailto:${actor.email}?subject=${subject}` } : undefined,
    footnote: 'Records AIC must keep, such as certificates, declarations and the oversight record of this removal, are retained as its published policies require. Everything else tied to the workspace has been removed.',
  };
}

/** Sends the notice to each recipient. Returns how many were accepted by the mail service. */
export async function sendRemovalNotice(input: { kind: 'organisation' | 'account'; subjectName: string; recipients: Recipient[]; actor: Actor; reason: string; reference: string; when?: Date }): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  const when = input.when ?? new Date();
  for (const r of input.recipients.slice(0, 200)) {
    try {
      const res = await sendEmail(removalEmail({ ...input, recipient: r, when }));
      if (res.sent) sent++; else failed++;
    } catch (e) {
      failed++;
      console.error('[REMOVAL_NOTICE]', input.reference, (e as Error).message);
    }
  }
  return { sent, failed };
}
