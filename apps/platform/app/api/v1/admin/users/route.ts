import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, sql, users, eq } from '@aic/db';
import { hasCapability } from '@/lib/rbac';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER', 'VIEWER']),
  orgId: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_users');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_users' }, { status: 403 });

  try {
    const db = getSystemDb();
    const allUsers = await db.execute(sql`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.is_active as "isActive",
        o.name as "orgName"
      FROM users u
      LEFT JOIN organizations o ON u.org_id = o.id
      ORDER BY u.created_at DESC
    `);
    return NextResponse.json(allUsers.rows);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_users');
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_users' }, { status: 403 });

  try {
    const body = await req.json();
    const validation = CreateUserSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }

    const { name, email, password, role, orgId } = validation.data;
    const db = getSystemDb();

    // Institutional integrity check: email uniqueness
    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) {
        return NextResponse.json({ error: 'Identity conflict', message: 'Email already registered' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);

    const [newUser] = await db.insert(users).values({
      name,
      email: email.toLowerCase(),
      passwordHash: hash,
      role,
      orgId: orgId || null,
      isActive: true
    }).returning({ id: users.id });

    return NextResponse.json({ success: true, userId: newUser.id }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_USER_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Internal system failure during user creation' }, { status: 500 });
  }
}
