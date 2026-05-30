import { NextResponse } from 'next/server';
import { getSystemDb, globalStandards, asc } from '@aic/db';

export async function GET() {
  try {
    const db = getSystemDb();
    const data = await db.select().from(globalStandards).orderBy(asc(globalStandards.region));
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUBLIC_STANDARDS_API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
