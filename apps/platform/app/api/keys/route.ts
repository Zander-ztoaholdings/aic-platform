import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, apiKeys, eq, and, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Session } from 'next-auth';

export async function GET() {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      const result = await tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
          isActive: apiKeys.isActive
        })
        .from(apiKeys)
        .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.isActive, true)))
        .orderBy(desc(apiKeys.createdAt));

      return NextResponse.json({ keys: result });
    });
  } catch (error) {
    console.error('[SECURITY] Keys GET Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve institutional keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Task M14: RBAC Enforcement - API keys are restricted to administrators
    if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only institutional administrators can generate API keys' }, { status: 403 });
    }

    const orgId = session.user.orgId;
    const body = await request.json();
    const { label } = body;

    // 1. Generate real API key (aic_live_ + 32 chars)
    const rawKey = crypto.randomBytes(24).toString('hex');
    const fullKey = `aic_live_${rawKey}`;
    const prefix = 'aic_live_';
    
    // 2. Hash for storage (Institutional Standard: Cost Factor 12)
    const salt = await bcrypt.genSalt(12);
    const keyHash = await bcrypt.hash(fullKey, salt);

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      await tx.insert(apiKeys).values({
        orgId,
        name: label || 'Default Key',
        keyPrefix: prefix,
        keyHash: keyHash,
        isActive: true
      });

      // 3. Return full key only once (Institutional Standard)
      return NextResponse.json({ 
          success: true, 
          apiKey: fullKey,
          warning: 'Store this key securely. It will not be shown again.'
      });
    });

  } catch (error) {
    console.error('[SECURITY] Key Generation Failure:', error);
    return NextResponse.json({ error: 'Failed to generate cryptographic key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can revoke API keys' }, { status: 403 });
    }

    const { keyId } = await request.json();
    if (!keyId) {
      return NextResponse.json({ error: 'keyId is required' }, { status: 400 });
    }

    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      await tx
        .update(apiKeys)
        .set({ isActive: false })
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.orgId, orgId)));

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[SECURITY] Key Revocation Failure:', error);
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }
}
