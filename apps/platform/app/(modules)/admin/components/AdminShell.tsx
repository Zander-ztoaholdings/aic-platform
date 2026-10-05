'use client';
import { PageTransition } from '@/app/components/ui/PageTransition';

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
 * Staff, HQ and client workspaces share one look (Zander, Oct 2026): the same
 * light canvas, top bar and type. Whose console this is, is said in words —
 * "AIC Staff" beside the mark — rather than by a different colour scheme. Navigation is the same component the client workspace uses, fed
 * from the same config, filtered by what this person's role can reach.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as WorkspaceUser & { name?: string | null; email?: string | null };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfcfd_0%,#f3f5f8_100%)] text-[#0e1b2c] font-sans">
      <ViewAsBanner />
      <WorkspaceTopBar
        tone="light"
        homeHref="/admin"
        contextLabel="AIC Staff"
        contextDetail={user.isSuperAdmin ? 'Super admin' : user.role === 'AIC_AUDITOR' ? 'Auditor' : null}
        groups={visibleGroups(STAFF_NAV, user)}
        accountItems={[]}
        isActive={isActive}
        user={{ name: user.name ?? null, email: user.email ?? null, roleLabel: null }}
      />
      <main className="max-w-[1200px] mx-auto px-5 md:px-8 pt-7 pb-20 md:pt-12 md:pb-24 text-[#0e1b2c]"><PageTransition>{children}</PageTransition></main>
    </div>
  );
}
