'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Menu } from 'lucide-react';

interface DashboardHeaderProps {
  pathname: string;
  onMenuOpen: () => void;
  unreadCount: number;
  showNotifs: boolean;
  setShowNotifs: (show: boolean) => void;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    status: 'UNREAD' | 'READ';
    created_at: string;
  }>;
  markAsRead: (id: string) => Promise<void> | void;
}

const PAGE_TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/evidence':       'Evidence Vault',
  '/pulse':          'Pulse Monitor',
  '/findings':       'Auditor Findings',
  '/reports':        'Compliance Reports',
  '/correspondence': 'Correspondence',
  '/certificate':    'My Certificate',
  '/practitioner':   'Practitioner (CAAP)',
  '/settings/keys':  'API & Access Keys',
  '/organisation':   'Organisation Profile',
};

export function DashboardHeader({
  pathname,
  onMenuOpen,
  unreadCount,
  showNotifs,
  setShowNotifs,
  notifications,
  markAsRead,
}: DashboardHeaderProps) {
  const pageTitle = PAGE_TITLES[pathname] ?? pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Dashboard';

  return (
    <header className="bg-white border-b border-[#e5e7eb] px-7 py-3.5 flex items-center justify-between gap-4">
      {/* Left: page eyebrow + org name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="md:hidden p-2 text-[#6b7280] hover:text-[#0f1f3d] bg-[#f0f4f8] rounded-lg border border-[#e5e7eb]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-px bg-[#c9920a] inline-block flex-shrink-0" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9920a]">
              {pageTitle}
            </span>
          </div>
          <h1 className="font-serif text-[20px] font-bold text-[#0f1f3d] leading-none tracking-tight">
            Meridian Financial Group
          </h1>
        </div>
      </div>

      {/* Right: badges + bell + user */}
      <div className="flex items-center gap-2.5">
        {/* Division badge */}
        <div className="hidden md:flex items-center gap-1.5 border border-[#e5e7eb] rounded-full px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">
          <span className="text-[#c9920a]">◆</span> Division 2 — Supervised
        </div>

        {/* Integrity badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0" />
          <span className="font-mono text-[9px] font-bold text-green-700 uppercase tracking-[0.12em]">Integrity: Secure</span>
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:text-[#0f1f3d] hover:bg-[#f0f4f8] transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 block h-1.5 w-1.5 rounded-full bg-[#c9920a] ring-2 ring-white" />
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 top-12 w-80 bg-white border border-[#e5e7eb] rounded-2xl shadow-2xl overflow-hidden z-20"
                >
                  <div className="px-5 py-3.5 border-b border-[#e5e7eb] flex justify-between items-center">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#6b7280]">
                      Registry Alerts
                    </span>
                    {unreadCount > 0 && (
                      <span className="font-mono text-[9px] font-bold text-[#c9920a] bg-amber-50 px-2 py-0.5 rounded">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`px-5 py-3.5 border-b border-[#f3f4f6] cursor-pointer hover:bg-[#f9fafb] transition-colors ${
                          n.status === 'UNREAD' ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-bold text-[#0f1f3d]">{n.title}</p>
                          <p className="font-mono text-[9px] text-[#9ca3af]">
                            {new Date(n.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <p className="text-[11px] text-[#6b7280] leading-relaxed line-clamp-2">{n.message}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-8 text-center text-[#9ca3af] text-sm font-serif italic">
                        No alerts at this time.
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 border-l border-[#e5e7eb] pl-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#0f1f3d] leading-none">Dr. Sarah Chen</div>
            <div className="font-mono text-[8px] text-[#c9920a] uppercase tracking-[0.12em] font-bold mt-0.5">
              Accountable Person
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#0f1f3d] flex items-center justify-center font-mono text-[10px] font-bold text-[#c9920a]">
            SC
          </div>
        </div>
      </div>
    </header>
  );
}
