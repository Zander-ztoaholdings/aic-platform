import { NextResponse } from 'next/server';
import { getSystemDb, resources, asc } from '@aic/db';

export async function GET() {
  try {
    const db = getSystemDb();
    const data = await db.select().from(resources).orderBy(asc(resources.title));
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUBLIC_RESOURCES_API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
