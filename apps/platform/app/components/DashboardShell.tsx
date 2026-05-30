'use client';

import { useDashboardState } from './dashboard/useDashboardState';
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { PhaseTracker } from './ui/PhaseTracker';
import { PulseBar } from './ui/PulseBar';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    pathname,
    notifications,
    showNotifs,
    setShowNotifs,
    showMobileMenu,
    setShowMobileMenu,
    markAsRead,
    isActive,
    unreadCount,
  } = useDashboardState();

  return (
    <div className="min-h-screen flex bg-[#f0f4f8]">
      <DashboardSidebar
        show={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        isActive={isActive}
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
          />
          <PhaseTracker currentPhase={2} />
          <PulseBar />
        </div>

        <main className="flex-1 px-7 py-6 fade-up">{children}</main>
      </div>
    </div>
  );
}
