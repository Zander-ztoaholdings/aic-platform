import { NextRequest, NextResponse } from 'next/server';
import { frameworksCaller } from '@/lib/frameworks/caller';
import { suggestMappings } from '@/lib/ai/map-requirements';
import { CUSTOM_LIMITS } from '@/lib/frameworks/custom';

/** Suggested common controls for each pasted requirement. Nothing is saved. */
export async function POST(request: NextRequest) {
  const c = await frameworksCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { requirements?: unknown };
  if (!Array.isArray(b.requirements)) return NextResponse.json({ error: 'Send the requirements.' }, { status: 400 });
  const reqs = (b.requirements as unknown[]).slice(0, CUSTOM_LIMITS.requirements).flatMap((r) => {
    const x = (r ?? {}) as { id?: unknown; title?: unknown };
    return typeof x.id === 'string' && typeof x.title === 'string' && x.title.trim() ? [{ id: x.id.slice(0, CUSTOM_LIMITS.ref), title: x.title.slice(0, CUSTOM_LIMITS.title) }] : [];
  });
  return NextResponse.json(await suggestMappings(reqs));
}
