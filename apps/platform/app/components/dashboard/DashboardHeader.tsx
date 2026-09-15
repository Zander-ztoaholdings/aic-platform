'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Menu } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ROLE_LABEL, type OrgRole } from '@/lib/roles';

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
  /** Real org fields from /api/shell-summary - null while still loading. */
  orgName: string | null;
  division: number | null;
  divisionName: string | null;
  certificationStatus: string | null;
  /** The signed-in person, from their own session - not the org. */
  userName: string | null;
  userEmail: string | null;
  userRole?: string;
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

// Certification status is a real, stored field (organizations.certification_status)
// - this only maps it to a colour so the badge reads at a glance. An
// unrecognised or missing status falls back to the neutral/grey style rather
// than guessing a more finished-looking one.
const STATUS_BADGE_STYLE: Record<string, string> = {
  CERTIFIED: 'bg-green-50 border-green-200 text-green-700',
  APPROVED: 'bg-green-50 border-green-200 text-green-700',
  PENDING_REVIEW: 'bg-amber-50 border-amber-200 text-amber-700',
  UNDER_REVIEW: 'bg-amber-50 border-amber-200 text-amber-700',
  IN_REVIEW: 'bg-amber-50 border-amber-200 text-amber-700',
  DRAFT: 'bg-gray-100 border-gray-200 text-gray-600',
};

function getInitials(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return '—';
  const namePart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const parts = namePart.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function DashboardHeader({
  pathname,
  onMenuOpen,
  unreadCount,
  showNotifs,
  setShowNotifs,
  notifications,
  markAsRead,
  orgName,
  division,
  divisionName,
  certificationStatus,
  userName,
  userEmail,
  userRole,
}: DashboardHeaderProps) {
  const pageTitle = PAGE_TITLES[pathname] ?? pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Dashboard';
  const roleLabel = userRole ? ROLE_LABEL[userRole as OrgRole] ?? userRole.replace(/_/g, ' ') : null;
  const displayName = userName ?? userEmail ?? 'Signed in';
  const initials = getInitials(userName ?? userEmail ?? '');
  const statusStyle = certificationStatus
    ? STATUS_BADGE_STYLE[certificationStatus] ?? 'bg-gray-100 border-gray-200 text-gray-600'
    : null;

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
            {orgName ?? 'Loading organisation…'}
          </h1>
        </div>
      </div>

      {/* Right: badges + bell + user */}
      <div className="flex items-center gap-2.5">
        {/* Division badge - only shown once the org actually has one set */}
        {divisionName && (
          <Badge
            variant="outline"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border-[#e5e7eb] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#6b7280]"
          >
            <span className="text-[#c9920a]">◆</span> Division {division} — {divisionName}
          </Badge>
        )}

        {/* Certification status badge - real value, coloured by status */}
        {certificationStatus && (
          <div className={`hidden md:flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${statusStyle}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em]">
              {certificationStatus.replace(/_/g, ' ')}
            </span>
          </div>
        )}

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

        {/* User - the signed-in person, from their own session */}
        <div className="flex items-center gap-2.5 border-l border-[#e5e7eb] pl-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#0f1f3d] leading-none">{displayName}</div>
            {roleLabel && (
              <div className="font-mono text-[8px] text-[#c9920a] uppercase tracking-[0.12em] font-bold mt-0.5">
                {roleLabel}
              </div>
            )}
          </div>
          <Avatar className="w-9 h-9 rounded-lg">
            <AvatarFallback className="rounded-lg bg-[#0f1f3d] font-mono text-[10px] font-bold text-[#c9920a]">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
