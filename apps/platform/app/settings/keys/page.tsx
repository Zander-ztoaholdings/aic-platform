'use client';
import { PageHeader } from '@/app/components/ui/PageHeader';

import { useEffect, useState } from 'react';
import { Plus, Check, Lock, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { canManageTeamAndKeys } from '@/lib/roles';
import DashboardShell from '../../components/DashboardShell';
import { SectionCard } from '../../components/ui/Eyebrow';
import { DeveloperGuide } from './DeveloperGuide';
import { StatusChip } from '../../components/ui/StatusChip';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
};

const SECURITY_RULES = [
  'Keys are scoped to your organisation only',
  'Rotate keys immediately if compromised',
  'Never expose keys in client-side code',
  'Keys can be revoked instantly from this panel',
];

export default function KeysPage() {
  const { data: session } = useSession();
  const canManageKeys = canManageTeamAndKeys((session?.user as { role?: string } | undefined)?.role);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = () => {
    fetch('/api/keys')
      .then(r => r.json())
      .then(d => { setKeys(d.keys ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchKeys(); }, []);


  const handleGenerate = async () => {
    if (!newKeyLabel.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel }),
      });
      const data = await res.json();
      if (data.apiKey) {
        setRevealedKey(data.apiKey);
        setNewKeyLabel('');
        fetchKeys();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevoking(keyId);
    try {
      await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      });
      fetchKeys();
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <DashboardShell>
      <div className="space-y-5">
        <PageHeader eyebrow="Account" title="API and access keys" lede="Keys let your systems record decisions and send usage to AIC. Each key works for your organisation only." />

        {/* Revealed key banner */}
        {revealedKey && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-amber-800 mb-1">New Key Generated — Store it now. It will not be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-amber-900 bg-amber-100 px-3 py-2 rounded-lg break-all">
                {revealedKey}
              </code>
              <button
                onClick={() => { navigator.clipboard?.writeText(revealedKey).catch(() => {}); }}
                className="text-[11px] font-bold text-amber-700 border border-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors whitespace-nowrap"
              >
                Copy key
              </button>
              <button
                onClick={() => setRevealedKey(null)}
                className="text-[11px] text-amber-600 hover:text-amber-800 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
          <div className="space-y-4">
            {/* Keys table */}
            <SectionCard>
              <div className="text-[12px] font-bold first-cap text-[#5e6b7b] mb-4">
                Active keys
              </div>
              <div className="border border-[#dde2e8] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_44px] sm:grid-cols-[1fr_100px_100px_80px_44px] gap-x-3 px-4 py-2.5 bg-[#f5f7f9] border-b border-[#dde2e8]">
                  {['Key', 'Created', 'Last used', 'Status', ''].map((h, i) => (
                    <span key={i} className={`text-[12px] font-semibold text-[#5e6b7b] ${i === 1 || i === 2 ? 'hidden sm:block' : ''}`}>{h}</span>
                  ))}
                </div>
                {loading ? (
                  <div className="px-4 py-6 text-center text-xs text-[#8a95a3]">Loading keys…</div>
                ) : keys.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#8a95a3]">No API keys yet. Generate your first key below.</div>
                ) : (
                  keys.map((k) => (
                    <div key={k.id} className="grid grid-cols-[1fr_auto_44px] sm:grid-cols-[1fr_100px_100px_80px_44px] gap-x-3 px-4 py-3 border-b border-[#eef1f5] last:border-0 items-center">
                      <div>
                        <div className="text-xs font-semibold text-[#0e1b2c] mb-0.5">{k.name}</div>
                        <div className="text-[11px] text-[#8a95a3]">
                          {k.keyPrefix}••••••••••••••••
                        </div>
                      </div>
                      <span className="hidden sm:block text-[12px] text-[#5e6b7b]">{formatDate(k.createdAt)}</span>
                      <span className="hidden sm:block text-[12px] text-[#5e6b7b]">{formatDate(k.lastUsedAt)}</span>
                      <StatusChip status={k.isActive ? 'active' : 'expired'} />
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        className="w-10 h-10 flex items-center justify-center text-[#8a95a3] hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Revoke key"
                        aria-label={`Revoke ${k.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Generate new key */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={e => setNewKeyLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="Key label, e.g. Production SDK"
                  className="flex-1 min-w-0 border border-[#dde2e8] rounded-full px-4 h-11 sm:h-auto sm:py-2 text-xs focus:outline-none focus:border-[#a8772a] transition-colors"
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !newKeyLabel.trim()}
                  className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-[#0e1b2c] border border-[#d5dbe2] rounded-full px-4 h-11 sm:h-auto sm:py-2 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> {generating ? 'Generating…' : 'Generate key'}
                </button>
              </div>
            </SectionCard>

            <DeveloperGuide canManage={canManageKeys} />
          </div>

          {/* Right rail */}
          <div className="space-y-3">
            <SectionCard className="p-4">
              <Lock className="w-5 h-5 text-[#a8772a] mb-2.5" />
              <div className="text-[12px] font-bold first-cap text-[#5e6b7b] mb-3">
                Keeping keys safe
              </div>
              <div className="space-y-2">
                {SECURITY_RULES.map((r) => (
                  <div key={r} className="flex gap-2 items-start">
                    <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-[#5e6b7b] leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
