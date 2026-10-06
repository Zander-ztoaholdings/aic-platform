import { NextRequest, NextResponse } from 'next/server';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { loadAgent } from '@/lib/agents/runtime';
import { checkAccess } from '@/lib/agents/sharepoint';
import type { AgentTool } from '@/lib/agents/config';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { "tool": "policies" }: can AIC's agent app open the site and library, and is its access narrow? */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { tool: name } = (await request.json().catch(() => ({}))) as { tool?: string };
  return guarded('017', async () => {
    const a = await loadAgent(c.orgId, id);
    const tool = ((a?.tools as AgentTool[] | undefined) ?? []).find((t) => t.name === name);
    if (!a || tool?.kind !== 'sharepoint') return NextResponse.json({ error: 'Save the tool first, then check it.' }, { status: 404 });
    return NextResponse.json(await checkAccess(tool));
  });
}
