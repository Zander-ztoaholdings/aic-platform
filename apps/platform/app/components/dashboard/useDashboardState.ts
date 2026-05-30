import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useDashboardState() {
  const pathname = usePathname();
  const router = useRouter();
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

  const fetchNotifs = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();

    // Task M34: Institutional Real-Time Connectivity (SSE)
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') {
          fetchNotifs();
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
    const interval = setInterval(fetchNotifs, 30000);

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
    unreadCount: notifications.filter(n => n.status === 'UNREAD').length
  };
}
