import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { verifyOrganizationChain } from '../../../../lib/immutability';
import type { Session } from 'next-auth';

export async function POST() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const result = await verifyOrganizationChain(orgId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[SECURITY] Verification API Error:', error);
    return NextResponse.json({ error: 'Failed to verify institutional integrity' }, { status: 500 });
  }
}
