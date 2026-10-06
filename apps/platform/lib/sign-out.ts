'use client';

import { signOut } from 'next-auth/react';
import { announceSessionChange } from '@/lib/session-guard';

/** Sign out, and let every other open tab know straight away. */
export function signOutEverywhere(): Promise<void> {
  announceSessionChange();
  return signOut({ callbackUrl: '/login' });
}
