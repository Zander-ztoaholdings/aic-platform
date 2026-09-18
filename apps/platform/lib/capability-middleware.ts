import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { hasCapability } from './rbac';
import type { Capability } from './capabilities';

/**
 * Higher-Order Function for API Handlers to enforce capability checks.
 * Usage: export const POST = withCapability('upload_bias_report', async (req) => { ... });
 */
export function withCapability(
  capability: Capability,
  handler: (req: NextRequest, context: unknown) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: unknown) => {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authorized = await hasCapability(session.user.id, capability);

    if (!authorized) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: `Missing required capability: ${capability}`,
          rationale: 'Action requires higher authorization level or specific auditor approval.'
        }, 
        { status: 403 }
      );
    }

    return handler(req, context);
  };
}
