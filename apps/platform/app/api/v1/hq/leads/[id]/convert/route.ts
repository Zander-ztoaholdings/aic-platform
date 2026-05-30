import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, leads, organizations, inviteCodes, eq } from '@aic/db';
import { getSession } from '../../../../../../../lib/auth';
import { NotificationService } from '@aic/notifications';
import crypto from 'crypto';
import Stripe from 'stripe';
import type { Session } from 'next-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession() as Session | null;
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { orgName, tier, contactEmail } = body;

  if (!orgName || !tier || !contactEmail) {
    return NextResponse.json({ error: 'orgName, tier, and contactEmail are required' }, { status: 400 });
  }

  const db = getSystemDb();

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const inviteCode = `INV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let stripeCustomerId: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customer = await stripe.customers.create({ name: orgName, email: contactEmail });
    stripeCustomerId = customer.id;
  }

  const [newOrg] = await db
    .insert(organizations)
    .values({ name: orgName, slug, tier, contactEmail, isAlpha: true, ...(stripeCustomerId ? { stripeCustomerId } : {}) })
    .returning({ id: organizations.id });

  await db.insert(inviteCodes).values({
    code: inviteCode,
    role: 'ADMIN',
    orgId: newOrg.id,
    maxUses: 1,
    expiresAt,
  });

  await db.update(leads).set({ status: 'CONVERTED', orgId: newOrg.id }).where(eq(leads.id, id));

  const onboardUrl = `${process.env.NEXTAUTH_URL}/onboard?code=${inviteCode}&org=${newOrg.id}`;
  await NotificationService.sendEmail({
    to: contactEmail,
    subject: 'Your AIC Certification Account is Ready',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 40px; border-radius: 8px;">
        <h2 style="color: #0A1728;">Welcome to AIC</h2>
        <p>Congratulations — <strong>${orgName}</strong> has been approved for AIC certification.</p>
        <p>Set up your account using the link below. This link expires in 7 days.</p>
        <div style="margin: 30px 0;">
          <a href="${onboardUrl}" style="background: #0A1728; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Create Your Account
          </a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          AI Integrity Certification · Johannesburg, South Africa
        </p>
      </div>
    `,
  });

  return NextResponse.json({ success: true, orgId: newOrg.id, inviteCode });
}
