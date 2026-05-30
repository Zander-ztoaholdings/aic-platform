import { NextRequest } from 'next/server';
import { auth } from '@aic/auth';
import { EventBusService } from '@aic/db';

/**
 * SOVEREIGN EVENT STREAM (SSE)
 * 
 * Provides a real-time, persistent connection for tenant-specific events.
 * Replaces amateur polling with institutional-grade push delivery.
 */
export async function GET(request: NextRequest) {
  const session = await auth() as any;
  
  if (!session || !session.user?.orgId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orgId = session.user.orgId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 1. Subscribe to the tenant channel
      const unsubscribe = EventBusService.subscribe(orgId, (message) => {
        const eventData = `data: ${message}\n\n`;
        controller.enqueue(encoder.encode(eventData));
      });

      // 2. Keep-alive heartbeat (Institutional Stability)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      // 3. Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
        console.log(`[SSE] Stream closed for tenant: ${orgId}`);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
