'use client';
import { PageTransition } from '@/app/components/ui/PageTransition';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ViewAsBanner } from './workspace/ViewAsBanner';
import { OnboardingTour, startTour } from './workspace/OnboardingTour';
import { Compass } from 'lucide-react';
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
      <ViewAsBanner />
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
        menuExtras={[{ label: 'Take the tour', onSelect: startTour, icon: Compass }]}
        actions={
          <span data-tour="notifications" className="inline-flex"><NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            open={showNotifs}
            setOpen={setShowNotifs}
            markAsRead={markAsRead}
          /></span>
        }
      />
      <div data-tour="status"><WorkspaceStatusStrip
        phase={phaseFromCertificationStatus(org?.certificationStatus)}
        decisions={orgSummary?.decisions.recorded ?? null}
        overrideRate={orgSummary?.decisions.humanOverrideRate ?? null}
        failingChecks={orgSummary?.checks && orgSummary.checks.total > 0 ? orgSummary.checks.failing : null}
        openCorrections={orgSummary?.corrections.open ?? null}
      /></div>
      <OnboardingTour orgName={org?.name ?? null} />
      <main className="max-w-[1200px] mx-auto px-5 md:px-8 pt-7 pb-20 md:pt-12 md:pb-24"><PageTransition>{children}</PageTransition></main>
    </div>
  );
}
