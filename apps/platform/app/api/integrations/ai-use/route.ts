import { NextResponse } from 'next/server';
import { getTenantDb, aiSystems, eq } from '@aic/db';
import { orgCaller } from '@/lib/integrations/http';
import { summariseAiUse } from '@/lib/ai-use/store';

/**
 * AI use across the organisation's tools, last 30 days, by product. Counts,
 * dates and names of people or models only; nothing a person wrote.
 */
export async function GET() {
  const caller = await orgCaller();
  if ('error' in caller) return caller.error;
  const systems = await getTenantDb(caller.orgId).query((tx) =>
    tx.select({ name: aiSystems.name, isActive: aiSystems.isActive }).from(aiSystems).where(eq(aiSystems.orgId, caller.orgId)));
  const names = systems.filter((s) => s.isActive !== false).map((s) => s.name.trim().toLowerCase());
  const products = await summariseAiUse(caller.orgId, names);
  return NextResponse.json({ products, canManage: caller.canManage });
}
