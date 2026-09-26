'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDashboardState } from './dashboard/useDashboardState';
import { phaseFromCertificationStatus } from './ui/PhaseTracker';
import { WorkspaceTopBar } from './workspace/WorkspaceTopBar';
import { WorkspaceStatusStrip } from './workspace/WorkspaceStatusStrip';
import { NotificationBell } from './workspace/NotificationBell';
import { CLIENT_NAV, CLIENT_ACCOUNT, visibleGroups, visibleItems } from './workspace/nav';
import { canUseClientWorkspace, homeFor, type WorkspaceUser } from '@/lib/workspace';
import { ROLE_LABEL, type OrgRole } from '@/lib/roles';

/**
 * The client workspace.
 *
 * A light canvas, one top bar with the three product menus, one quiet status
 * line, and the full width for the page. The dark 256px sidebar is gone, and
 * with it the hardcoded "Example Organisation" it printed under the logo for
 * every client.
 *
 * A session that cannot use this workspace — AIC staff with no organisation —
 * is sent to its own home rather than left on a page whose every request needs
 * an organisation it does not have. The server gates /admin and /hq; the
 * client pages predate a layout of their own, so this is where that check
 * lives for now.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    notifications,
    showNotifs,
    setShowNotifs,
    markAsRead,
    isActive,
    unreadCount,
    orgSummary,
    userName,
    userEmail,
    role,
  } = useDashboardState();

  const router = useRouter();
  const { data: session, status } = useSession();
  const user = (session?.user ?? {}) as WorkspaceUser;

  useEffect(() => {
    if (status === 'authenticated' && !canUseClientWorkspace(user)) {
      router.replace(homeFor(user));
    }
  }, [status, user, router]);

  const org = orgSummary?.organisation;
  const contextDetail = org?.divisionName
    ? `Division 0${org.division} · ${org.divisionName}`
    : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfcfd_0%,#f3f5f8_100%)]">
      <WorkspaceTopBar
        tone="light"
        homeHref="/"
        contextLabel={org?.name ?? null}
        contextDetail={contextDetail}
        groups={visibleGroups(CLIENT_NAV, user)}
        accountItems={visibleItems(CLIENT_ACCOUNT, user)}
        isActive={isActive}
        user={{
          name: userName,
          email: userEmail,
          roleLabel: role ? ROLE_LABEL[role as OrgRole] ?? null : null,
        }}
        actions={
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            open={showNotifs}
            setOpen={setShowNotifs}
            markAsRead={markAsRead}
          />
        }
      />
      <WorkspaceStatusStrip
        phase={phaseFromCertificationStatus(org?.certificationStatus)}
        decisions={orgSummary?.decisions.recorded ?? null}
        overrideRate={orgSummary?.decisions.humanOverrideRate ?? null}
        integrityScore={org?.integrityScore ?? null}
        openCorrections={orgSummary?.corrections.open ?? null}
      />
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-7 fade-up">{children}</main>
    </div>
  );
}
