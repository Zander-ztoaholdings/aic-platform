'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';

export interface WorkspaceNotification {
  id: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  created_at: string;
}

/** The client workspace's notifications, lifted out of the old header unchanged in behaviour. */
export function NotificationBell({
  notifications,
  unreadCount,
  open,
  setOpen,
  markAsRead,
}: {
  notifications: WorkspaceNotification[];
  unreadCount: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  markAsRead: (id: string) => Promise<void> | void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-[#6b7280] hover:text-[#0A1728] hover:bg-[#0a1728]/[0.04] transition-colors"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#c9920a] ring-2 ring-white" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 w-[340px] rounded-2xl border border-[#0a1728]/[0.07] bg-white shadow-[0_18px_48px_-18px_rgba(10,23,40,0.22)] overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-[#0a1728]/[0.06] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#0A1728]">Notifications</span>
                {unreadCount > 0 && <span className="text-[12px] text-[#a87a08]">{unreadCount} unread</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#0a1728]/[0.04] hover:bg-[#0a1728]/[0.025] transition-colors ${
                      n.status === 'UNREAD' ? 'bg-[#c9920a]/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-medium text-[#0A1728]">{n.title}</p>
                      <p className="text-[11px] text-[#9ca3af] shrink-0">{new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="text-[12px] text-[#6b7280] leading-relaxed line-clamp-2 mt-0.5">{n.message}</p>
                  </button>
                ))}
                {notifications.length === 0 && (
                  <p className="px-4 py-10 text-center text-[13px] text-[#9ca3af]">Nothing new.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
