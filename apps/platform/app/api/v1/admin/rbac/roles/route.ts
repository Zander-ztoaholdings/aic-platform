import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, roles, roleCapabilities, capabilities, eq } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * Roles with their assigned capability slugs - app/admin/permissions
 * ("God Mode"), Role Management tab.
 *
 * The capability toggle switches and "Create Custom Role" button on that
 * page are not wired to any endpoint yet (no onClick handlers exist in the
 * component) - this route only supplies the read side the page already
 * calls on load. Wiring the mutations is a separate, deliberately
 * unstarted piece: it touches who can grant/revoke access at all, and
 * deserves its own confirmation step rather than being backed in silently.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'access_admin_tools');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: access_admin_tools' }, { status: 403 });
  }

  try {
    const db = getSystemDb();
    const allRoles = await db.select().from(roles).orderBy(roles.name);
    const grants = await db
      .select({ roleId: roleCapabilities.roleId, slug: capabilities.slug })
      .from(roleCapabilities)
      .innerJoin(capabilities, eq(roleCapabilities.capabilityId, capabilities.id));

    const byRole = new Map<string, string[]>();
    for (const g of grants) {
      if (!g.roleId) continue;
      const list = byRole.get(g.roleId) ?? [];
      list.push(g.slug);
      byRole.set(g.roleId, list);
    }

    const result = allRoles.map((r) => ({ ...r, capabilities: byRole.get(r.id) ?? [] }));
    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}
