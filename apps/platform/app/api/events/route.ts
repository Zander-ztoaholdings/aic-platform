import { EventBusService } from '@aic/db';
import { auth } from '@aic/auth';
import { AICSessionUser } from '@aic/types';

/**
 * SOVEREIGN REAL-TIME EVENT STREAM (SSE)
 * 
 * Provides a persistent connection for real-time dashboard updates.
 * Strictly tenant-isolated via session-based orgId verification.
 */
export async function GET(request: Request) {
  const session = await auth() as { user: AICSessionUser } | null;

  if (!session?.user?.orgId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orgId = session.user.orgId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial heartbeat
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}

`));

      // 2. Subscribe to Redis via EventBus
      const cleanup = EventBusService.subscribe(orgId, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}

`));
        } catch {
          console.error('[SSE] Stream closed by client');
          cleanup();
        }
      });

      // 3. Handle connection close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client ${orgId} disconnected`);
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
