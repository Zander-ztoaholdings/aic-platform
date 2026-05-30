import { NextResponse } from 'next/server';
import { getSystemDb, personnelCertifications, asc } from '@aic/db';

export async function GET() {
  try {
    const db = getSystemDb();
    const data = await db.select().from(personnelCertifications).orderBy(asc(personnelCertifications.level));
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUBLIC_CERTIFICATIONS_API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
