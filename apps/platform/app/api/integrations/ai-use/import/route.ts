import { NextResponse } from 'next/server';
import { orgCaller } from '@/lib/integrations/http';
import { parseUsageExport } from '@/lib/ai-use/import';
import { saveAiUse } from '@/lib/ai-use/store';
import { IMPORTABLE, AI_PRODUCTS, type AiProduct } from '@/lib/ai-use/products';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Imports a vendor's own user export for an AI product that has no reporting
 * API on the organisation's plan. Administrators only. The file itself is not
 * kept: only email, name, message count and last-active date per person.
 */
export async function POST(request: Request) {
  const caller = await orgCaller();
  if ('error' in caller) return caller.error;
  if (!caller.canManage) return NextResponse.json({ error: 'Only an organisation administrator can import usage.' }, { status: 403 });
  if (!(await checkRateLimit(`ai-use-import:${caller.orgId}`, 20, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: 'Too many imports in a short time. Try again later.' }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { product?: string; csv?: string } | null;
  const product = body?.product as AiProduct | undefined;
  if (!product || !IMPORTABLE.includes(product)) return NextResponse.json({ error: 'Choose which product the export is from.' }, { status: 400 });
  if (typeof body?.csv !== 'string' || !body.csv.trim()) return NextResponse.json({ error: 'Choose a CSV file to import.' }, { status: 400 });
  if (body.csv.length > 5_000_000) return NextResponse.json({ error: 'That file is larger than 5 MB. Export a shorter period.' }, { status: 413 });

  const parsed = parseUsageExport(body.csv, product);
  if (!parsed.records.length) return NextResponse.json({ error: parsed.problems[0] ?? 'Nothing in the file could be read.' }, { status: 400 });
  const stored = await saveAiUse(caller.orgId, 'import', parsed.records);
  if (!stored) return NextResponse.json({ error: 'AI use cannot be stored yet: migration 020 has not been applied to this server.' }, { status: 503 });
  return NextResponse.json({
    ok: true,
    message: `Imported ${stored} ${stored === 1 ? 'person' : 'people'} from your ${AI_PRODUCTS[product].name} export.`,
    problems: parsed.problems,
    columns: parsed.columns,
  });
}
