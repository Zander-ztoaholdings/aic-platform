'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ViewAsBanner } from '@/app/components/workspace/ViewAsBanner';
import { ReactNode } from 'react';
import { WorkspaceTopBar } from '@/app/components/workspace/WorkspaceTopBar';
import { STAFF_NAV, visibleGroups } from '@/app/components/workspace/nav';
import type { WorkspaceUser } from '@/lib/workspace';

/**
 * The staff workspace shell.
 *
 * WHAT IT REPLACES, AND WHY.
 *
 *   - Every navigation link pointed at a path that does not exist: /leads,
 *     /organizations, /audits and so on, when the pages live under /admin. The
 *     "Dashboard" link sent staff to the client workspace.
 *   - An "ENGINE_SYNC_ACTIVE" badge glowed green on every page. The analysis
 *     engine was last recorded down; the badge was a literal string.
 *   - "Execute New Audit" POSTed an audit against a hardcoded org id labelled
 *     "Default Alpha Org", whichever client the staff member was looking at.
 *
 * Staff pages were written for the dark canvas, so the staff workspace keeps
 * it — which is also useful on its own terms: AIC staff should never be in
 * doubt about whether they are looking at their own console or a client's
 * workspace. Navigation is the same component the client workspace uses, fed
 * from the same config, filtered by what this person's role can reach.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as WorkspaceUser & { name?: string | null; email?: string | null };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-aic-navy text-aic-paper font-sans">
      <ViewAsBanner />
      <WorkspaceTopBar
        tone="dark"
        homeHref="/admin"
        contextLabel="AIC Staff"
        contextDetail={user.isSuperAdmin ? 'Super admin' : user.role === 'AIC_AUDITOR' ? 'Auditor' : null}
        groups={visibleGroups(STAFF_NAV, user)}
        accountItems={[]}
        isActive={isActive}
        user={{ name: user.name ?? null, email: user.email ?? null, roleLabel: null }}
      />
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 text-aic-paper">{children}</main>
    </div>
  );
}
