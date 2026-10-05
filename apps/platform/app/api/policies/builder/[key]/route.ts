import { NextResponse } from 'next/server';
import { policyCaller } from '@/lib/policies';
import { BUILDERS } from '@/lib/policy-builder';
import { builderContext } from '@/lib/policy-builder-data';
import { TEMPLATE_BY_KEY } from '@/lib/policy-templates';
import { CLAIMS } from '@/lib/says-vs-does';

/** The questions for one policy, with answers pre-filled from the organisation's record. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const { key } = await params;
  const b = BUILDERS[key];
  const t = TEMPLATE_BY_KEY[key];
  if (!b || !t) return NextResponse.json({ error: 'Unknown policy.' }, { status: 404 });
  const ctx = await builderContext(c.orgId);
  return NextResponse.json({
    key, title: t.title, summary: t.summary, controls: t.controls,
    questions: b.questions, defaults: b.defaults(ctx), ctx,
    monitored: CLAIMS.filter((x) => b.monitored.includes(x.id)).map((x) => ({ id: x.id, says: x.says })),
  });
}
