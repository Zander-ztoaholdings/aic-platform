import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, organizations, eq } from '@aic/db';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let payload: Stripe.Event;
  try {
    payload = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getSystemDb();

  switch (payload.type) {
    case 'checkout.session.completed': {
      const session = payload.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      if (!customerId) break;
      const planId = session.metadata?.planId || 'PRO_CERT';

      await db.update(organizations)
        .set({ 
          billingStatus: 'ACTIVE',
          stripeCustomerId: customerId,
          planId: planId
        })
        .where(eq(organizations.stripeCustomerId, customerId));
      
      console.log(`[STRIPE] JIT Provisioning complete for customer ${customerId}`);
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = payload.data.object as Stripe.Invoice;
      const failedCustomerId = typeof failedInvoice.customer === 'string' ? failedInvoice.customer : null;
      if (!failedCustomerId) break;
      await db.update(organizations)
        .set({ billingStatus: 'PAST_DUE' })
        .where(eq(organizations.stripeCustomerId, failedCustomerId));
      
      console.log(`[STRIPE] Revoking capabilities for customer ${failedCustomerId} due to payment failure`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
