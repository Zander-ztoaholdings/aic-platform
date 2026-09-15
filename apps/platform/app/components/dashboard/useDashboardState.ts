import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export interface OrgSummary {
  organisation: {
    name: string;
    division: number | null;
    divisionName: string | null;
    certificationStatus: string | null;
    integrityScore: number | null;
  };
  decisions: {
    recorded: number;
    humanOverrideRate: number | null;
  };
  corrections: {
    open: number;
  };
}

export function useDashboardState() {
  const pathname = usePathname();
  const router = useRouter();
  // The signed-in person's org-level role - the one thing the sidebar and
  // every page under DashboardShell need to know to show a role-appropriate
  // view instead of the same flat access to everyone. See lib/roles.ts.
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userName = session?.user?.name ?? null;
  const userEmail = session?.user?.email ?? null;
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    status: 'UNREAD' | 'READ';
    created_at: string;
  }>>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // The real org name, division, certification status and pulse counters
  // for the header/phase-tracker/pulse-bar - see /api/shell-summary. Starts
  // null so those components render an honest loading/empty state instead
  // of a placeholder number while this resolves.
  const [orgSummary, setOrgSummary] = useState<OrgSummary | null>(null);

  const fetchNotifs = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const fetchOrgSummary = async () => {
    try {
      const res = await fetch('/api/shell-summary');
      if (!res.ok) return;
      const data = await res.json();
      setOrgSummary(data);
    } catch (err) {
      console.error('Failed to fetch org summary:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    fetchOrgSummary();

    // Task M34: Institutional Real-Time Connectivity (SSE)
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') {
          fetchNotifs();
          fetchOrgSummary();
        }
      } catch {
        console.error('[SSE] Failed to parse event block');
      }
    };

    eventSource.onerror = () => {
      console.warn('[SSE] Sovereign link degraded. Reverting to 30s polling fallback.');
      eventSource.close();
    };

    // Fallback Polling (Resilience Override)
    const interval = setInterval(() => {
      fetchNotifs();
      fetchOrgSummary();
    }, 30000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/audits?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    fetchNotifs();
  };

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname.startsWith(href);
  };

  return {
    pathname,
    role,
    userName,
    userEmail,
    notifications,
    showNotifs,
    setShowNotifs,
    searchQuery,
    setSearchQuery,
    showMobileMenu,
    setShowMobileMenu,
    handleSearch,
    markAsRead,
    isActive,
    orgSummary,
    unreadCount: notifications.filter(n => n.status === 'UNREAD').length
  };
}
