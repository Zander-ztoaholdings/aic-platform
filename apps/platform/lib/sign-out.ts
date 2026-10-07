'use client';

import { signOut } from 'next-auth/react';
import { announceSessionChange } from '@/lib/session-guard';

/**
 * Sign out, and let every other open tab know straight away.
 *
 * First, a continuity observation, so what this person changed is on the
 * record as they leave. It is given two seconds at most: signing out must
 * never wait on it, and the five-minute observer catches anything it misses.
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    await Promise.race([
      fetch('/api/org/continuity/checkpoint', { method: 'POST', keepalive: true }),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch { /* never block sign-out */ }
  announceSessionChange();
  return signOut({ callbackUrl: '/login' });
}
