import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, globalStandards, eq, desc } from '@aic/db';
import { auth } from '@aic/auth';
import { z } from 'zod';

const StandardSchema = z.object({
  region: z.string().min(2),
  framework: z.string().min(2),
  status: z.enum(['Enacted', 'Active', 'Pending']),
  level: z.enum(['High', 'Moderate', 'Voluntary']),
  year: z.string().regex(/^\d{4}$/),
  alignment: z.number().min(0).max(100),
});

export async function GET(request: Request) {
  try {
    const db = getSystemDb();
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    let query = db.select().from(globalStandards);
    if (region) {
        query = db.select().from(globalStandards).where(eq(globalStandards.region, region)) as any;
    }

    const standards = await query.orderBy(desc(globalStandards.year));
    return NextResponse.json(standards);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch standards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: AIC Governance access only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = StandardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }

    const db = getSystemDb();
    const [newStandard] = await db.insert(globalStandards).values(validation.data).returning();

    return NextResponse.json(newStandard, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to register standard' }, { status: 500 });
  }
}
