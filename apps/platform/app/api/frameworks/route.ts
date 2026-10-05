import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgFrameworks, eq } from '@aic/db';
import { computeControls } from '@/lib/controls-data';
import { coverage } from '@/lib/controls';
import { CATALOGUE, CATALOGUE_BY_KEY, GROUP_LABEL } from '@/lib/frameworks/catalog';
import { COMMON_CONTROLS, AREA_LABEL } from '@/lib/common-controls';
import { frameworksCaller, NOT_READY, isMissingTable } from '@/lib/frameworks/caller';

export const dynamic = 'force-dynamic';

/** The catalogue, with the organisation's coverage of each framework, its choice, and its own frameworks. */
export async function GET() {
  const c = await frameworksCaller();
  if ('error' in c) return c.error;
  const r = await computeControls(c.orgId);
  const custom = r.custom.map((f) => ({
    id: f.id, key: f.key, name: f.name, description: f.description, requirements: f.requirements,
    coverage: coverage(r.controls.filter((x) => x.framework === f.key)),
  }));
  return NextResponse.json({
    canManage: c.canManage,
    storeReady: r.storeReady,
    chosen: r.chosen,
    selected: r.selected,
    groups: GROUP_LABEL,
    catalogue: CATALOGUE.map(({ requirements, ...meta }) => ({
      ...meta,
      requirementCount: requirements.length,
      coverage: coverage(r.catalogue.filter((x) => x.framework === meta.key)),
    })),
    aic: coverage(r.controls.filter((x) => x.framework === 'aic')),
    custom,
    commonControls: COMMON_CONTROLS.map(({ key, title, area }) => ({ key, title, area })),
    areas: AREA_LABEL,
  });
}

/** Save which catalogue frameworks the organisation tracks. */
export async function PUT(request: NextRequest) {
  const c = await frameworksCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { selected?: unknown };
  if (!Array.isArray(b.selected)) return NextResponse.json({ error: 'Send the list of frameworks to track.' }, { status: 400 });
  const keys = [...new Set(b.selected.filter((k): k is string => typeof k === 'string'))];
  const unknown = keys.find((k) => !CATALOGUE_BY_KEY[k]);
  if (unknown) return NextResponse.json({ error: `AIC does not know the framework "${unknown}".` }, { status: 400 });
  try {
    await getTenantDb(c.orgId).query(async (tx) => {
      await tx.delete(orgFrameworks).where(eq(orgFrameworks.orgId, c.orgId));
      // 'aic' is always stored, so a saved choice of nothing else is still a choice.
      await tx.insert(orgFrameworks).values(['aic', ...keys].map((k) => ({ orgId: c.orgId, frameworkKey: k, addedBy: c.userId })));
    });
  } catch (e) {
    if (isMissingTable(e)) return NOT_READY();
    throw e;
  }
  return NextResponse.json({ selected: keys });
}
