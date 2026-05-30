import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSystemDb, organizations, eq, LedgerService } from '@aic/db';
import type { CertificationTier } from '@aic/types';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
     
    apiVersion: '2026-01-28.clover' as any,
  });

  const body = await request.text();
  const sig = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    if (!endpointSecret) throw new Error('Webhook secret not configured');
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const tier = session.metadata?.tier as CertificationTier;

      // Task M36: Institutional Billing - Update organization tier/status
      if (orgId && tier) {
          // [SECURITY] getSystemDb() used for asynchronous billing updates.
          // The orgId is verified against the system database.
          const db = getSystemDb();
          
          // Verify org exists before update to prevent orphan records/logic errors
          const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
          
          if (org) {
              console.log(`[BILLING] Subscription completed for Org: ${orgId}, Tier: ${tier}`);
              await db
                .update(organizations)
                .set({ tier: tier })
                .where(eq(organizations.id, orgId));

              // Record in immutable ledger
              await LedgerService.append('ORG_TIER_UPDATE', null, {
                  orgId,
                  newTier: tier,
                  source: 'STRIPE_WEBHOOK'
              });
          } else {
              console.warn(`[BILLING] Received webhook for non-existent Org: ${orgId}`);
          }
      }
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
