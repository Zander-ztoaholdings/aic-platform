'use client';

import { useEffect, useState } from 'react';
import { Plus, Copy, Check, ExternalLink, Lock, Trash2 } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import { Eyebrow, SectionCard } from '../../components/ui/Eyebrow';
import { StatusChip } from '../../components/ui/StatusChip';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
};

const SDK_SNIPPET = `{
  "decision_id":           "unique-id",
  "system_name":           "credit-scoring-v2",
  "decision_type":         "loan-approval",
  "outcome":               "declined",
  "affected_person_ref":   "anonymised-hash",
  "timestamp":             "2026-04-19T10:00:00Z",
  "human_review_required":  true,
  "human_review_completed": false,
  "human_reviewer_id":     null,
  "override_applied":      false,
  "correction_requested":  false
}`;

const SECURITY_RULES = [
  'Keys are scoped to your organisation only',
  'Rotate keys immediately if compromised',
  'Never expose keys in client-side code',
  'Keys can be revoked instantly from this panel',
];

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
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

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(SDK_SNIPPET).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <Eyebrow>API & Access Keys</Eyebrow>

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
                className="font-mono text-[9px] font-bold text-amber-700 border border-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors whitespace-nowrap"
              >
                Copy Key
              </button>
              <button
                onClick={() => setRevealedKey(null)}
                className="font-mono text-[9px] text-amber-600 hover:text-amber-800 transition-colors"
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
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
                Active Keys
              </div>
              <div className="border border-[#e5e7eb] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px_80px_44px] px-4 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                  {['Key / Name', 'Created', 'Last Used', 'Status', ''].map((h, i) => (
                    <span key={i} className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{h}</span>
                  ))}
                </div>
                {loading ? (
                  <div className="px-4 py-6 text-center text-xs text-[#9ca3af]">Loading keys…</div>
                ) : keys.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#9ca3af]">No API keys yet. Generate your first key below.</div>
                ) : (
                  keys.map((k) => (
                    <div key={k.id} className="grid grid-cols-[1fr_100px_100px_80px_44px] px-4 py-3 border-b border-[#f3f4f6] last:border-0 items-center">
                      <div>
                        <div className="text-xs font-semibold text-[#0f1f3d] mb-0.5">{k.name}</div>
                        <div className="font-mono text-[9px] text-[#9ca3af]">
                          {k.keyPrefix}••••••••••••••••
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-[#9ca3af]">{formatDate(k.createdAt)}</span>
                      <span className="font-mono text-[9px] text-[#9ca3af]">{formatDate(k.lastUsedAt)}</span>
                      <StatusChip status={k.isActive ? 'active' : 'expired'} />
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        className="p-1 text-[#9ca3af] hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Revoke key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Generate new key */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={e => setNewKeyLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="Key label, e.g. Production SDK"
                  className="flex-1 border border-[#e5e7eb] rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#c9920a] transition-colors"
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !newKeyLabel.trim()}
                  className="inline-flex items-center gap-2 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-4 py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> {generating ? 'Generating…' : 'Generate Key'}
                </button>
              </div>
            </SectionCard>

            {/* SDK snippet */}
            <SectionCard>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                Pulse SDK — Minimum Viable Event
              </div>
              <div className="bg-[#0a1628] rounded-xl p-4 overflow-x-auto mb-3">
                <pre className="font-mono text-xs text-white/80 leading-relaxed m-0">{SDK_SNIPPET}</pre>
              </div>
              <div className="flex gap-2.5">
                <button className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-4 py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
                  <ExternalLink className="w-3 h-3" /> SDK Documentation
                </button>
                <button
                  onClick={handleCopySnippet}
                  className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-4 py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy Schema'}
                </button>
              </div>
            </SectionCard>
          </div>

          {/* Right rail */}
          <div className="space-y-3">
            <SectionCard className="p-4">
              <Lock className="w-5 h-5 text-[#c9920a] mb-2.5" />
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                Key Security
              </div>
              <div className="space-y-2">
                {SECURITY_RULES.map((r) => (
                  <div key={r} className="flex gap-2 items-start">
                    <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-[#6b7280] leading-relaxed">{r}</span>
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
