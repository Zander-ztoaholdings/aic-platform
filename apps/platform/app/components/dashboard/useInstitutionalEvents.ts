'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * INSTITUTIONAL EVENT HOOK
 * 
 * Manages the persistent SSE connection to the AIC Event Bus.
 * Automatically handles reconnection and dispatches toasts for critical events.
 */
export function useInstitutionalEvents() {
  const [lastEvent, setLastEntry] = useState<any>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      console.log('[SSE] Connecting to institutional stream...');
      eventSource = new EventSource('/api/notifications/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEntry(data);

          // 1. Intelligent Toast Delivery
          if (data.type === 'AUDIT_COMPLETED') {
            toast.success(`Audit Resolved: ${data.payload.systemName} scored ${data.payload.score}%`);
          } else if (data.type === 'INCIDENT_FLAGGED') {
            toast.error(`Critical Alert: New incident reported!`);
          }
        } catch (e) {
          console.error('[SSE] Failed to parse event data', e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[SSE] Connection lost. Attempting institutional recovery...', err);
        eventSource?.close();
        setTimeout(connect, 5000); // Exponential backoff in production
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  return { lastEvent };
}
