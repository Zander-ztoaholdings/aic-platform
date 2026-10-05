import { NextResponse } from 'next/server';
import { policyCaller } from '@/lib/policies';
import { orgCallbackSecret } from '@/lib/decision-review';

/** The secret AIC signs decision-review callbacks with. Organisation admins only. */
export async function GET() {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  try {
    return NextResponse.json({ secret: orgCallbackSecret(c.orgId) });
  } catch {
    return NextResponse.json({ error: 'Callback signing is not switched on for this AIC server yet.' }, { status: 503 });
  }
}
