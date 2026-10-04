'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CheckDefinition } from '@/lib/integrations/catalog';

export type Integration = {
  id: string;
  provider: 'github' | 'openai' | 'anthropic';
  mode: 'github_app' | 'exporter' | 'api_key';
  status: 'pending' | 'active' | 'error' | 'disconnected';
  accountLabel: string | null;
  externalId: string | null;
  secretHint: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  settings: { repositories?: string[]; repositoriesTotal?: number; links?: Record<string, string> } & Record<string, unknown>;
  createdAt: string;
};

export type Check = {
  id: string;
  checkKey: string;
  subject: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  summary: string;
  detail: Record<string, unknown>;
  failingSince: string | null;
  observedAt: string;
  provider: string | null;
};

export type IntegrationsData = {
  canManage: boolean;
  githubAppConfigured: boolean;
  integrations: Integration[];
  checks: Check[];
  catalog: CheckDefinition[];
  systems: { id: string; name: string }[];
};

export function useIntegrations() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load connected systems.');
      setData(body);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, reload: load };
}

export async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data } : { ok: false, error: data.error || 'Something went wrong. Try again.' };
}

export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
