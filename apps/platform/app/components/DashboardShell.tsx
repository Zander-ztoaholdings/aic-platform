'use client';

import { useDashboardState } from './dashboard/useDashboardState';
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { PhaseTracker, phaseFromCertificationStatus } from './ui/PhaseTracker';
import { PulseBar } from './ui/PulseBar';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    pathname,
    role,
    userName,
    userEmail,
    notifications,
    showNotifs,
    setShowNotifs,
    showMobileMenu,
    setShowMobileMenu,
    markAsRead,
    isActive,
    unreadCount,
    orgSummary,
  } = useDashboardState();

  const currentPhase = phaseFromCertificationStatus(orgSummary?.organisation.certificationStatus);

  return (
    <div className="min-h-screen flex bg-[#f0f4f8]">
      <DashboardSidebar
        show={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        isActive={isActive}
        role={role}
      />

      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
        {/* Sticky header stack: Header → PhaseTracker → PulseBar */}
        <div className="sticky top-0 z-30">
          <DashboardHeader
            pathname={pathname}
            onMenuOpen={() => setShowMobileMenu(true)}
            unreadCount={unreadCount}
            showNotifs={showNotifs}
            setShowNotifs={setShowNotifs}
            notifications={notifications}
            markAsRead={markAsRead}
            orgName={orgSummary?.organisation.name ?? null}
            division={orgSummary?.organisation.division ?? null}
            divisionName={orgSummary?.organisation.divisionName ?? null}
            certificationStatus={orgSummary?.organisation.certificationStatus ?? null}
            userName={userName}
            userEmail={userEmail}
            userRole={role}
          />
          <PhaseTracker currentPhase={currentPhase} />
          <PulseBar
            decisions={orgSummary?.decisions.recorded ?? null}
            overrideRate={orgSummary?.decisions.humanOverrideRate ?? null}
            integrityScore={orgSummary?.organisation.integrityScore ?? null}
            openCorrections={orgSummary?.corrections.open ?? null}
          />
        </div>

        <main className="flex-1 px-7 py-6 fade-up">{children}</main>
      </div>
    </div>
  );
}
