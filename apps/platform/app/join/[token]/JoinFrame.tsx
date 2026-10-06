'use client';

import { AuthFrame } from '@/app/components/auth/AuthFrame';

export function JoinFrame({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return <AuthFrame title={title} subtitle={subtitle} width={480}>{children}</AuthFrame>;
}
