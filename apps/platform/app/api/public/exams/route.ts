import { NextResponse } from 'next/server';
import { getSystemDb, exams, asc } from '@aic/db';

export async function GET() {
  try {
    const db = getSystemDb();
    const data = await db.select().from(exams).orderBy(asc(exams.date));
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUBLIC_EXAMS_API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
