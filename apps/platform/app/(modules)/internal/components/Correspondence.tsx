'use client';

import { useEffect, useState } from 'react';
import { Send, Info, Check } from 'lucide-react';
import { Eyebrow, SectionCard } from '@/app/components/ui/Eyebrow';
import { StatusChip } from '@/app/components/ui/StatusChip';

type Message = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  status: string;
  createdAt: string;
};

const RULES = [
  'All correspondence is logged and forms part of the audit record (DOC-015)',
  'Do not share personal information of affected individuals in messages',
  'Remediation evidence must be uploaded via Evidence Vault, not sent in messages',
];

export default function Correspondence() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMessages = () => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setMessages(d.notifications ?? []))
      .catch(() => {});
  };

  useEffect(() => { fetchMessages(); }, []);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Client Message', message, type: 'CORRESPONDENCE' }),
      });
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
      fetchMessages();
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter(m => m.status === 'UNREAD').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
      <div className="space-y-4">
        <Eyebrow>Auditor Correspondence</Eyebrow>

        <SectionCard>
          <div className="flex justify-between items-center mb-4">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
              Correspondence Thread
            </span>
            {unreadCount > 0 && <StatusChip status="partial" />}
          </div>

          {messages.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#9ca3af]">
              No correspondence yet. Messages from your auditor will appear here.
            </div>
          ) : (
            <div className="divide-y divide-[#f3f4f6]">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3 py-4">
                  <div className="w-9 h-9 rounded-lg bg-[#f0f4f8] flex items-center justify-center font-mono text-[9px] font-bold text-[#c9920a] flex-shrink-0">
                    {m.type === 'CORRESPONDENCE' ? 'YOU' : 'AIC'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-[#0f1f3d]">
                        {m.type === 'CORRESPONDENCE' ? 'You' : 'System Auditor'}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.status === 'UNREAD' && (
                          <span className="font-mono text-[8px] font-bold text-[#c9920a] bg-amber-50 px-1.5 py-0.5 rounded">
                            UNREAD
                          </span>
                        )}
                        <span className="font-mono text-[8px] text-[#9ca3af]">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#6b7280] leading-relaxed">
                      {m.message ?? m.title ?? '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sent && (
            <div className="mt-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">Message sent to your auditor.</span>
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
            Reply to Auditor
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message…"
            className="w-full bg-[#f9fafb] border border-[#e5e7eb] rounded-lg text-[#0f1f3d] text-xs px-3 py-2.5 resize-y min-h-[96px] outline-none leading-relaxed focus:border-[#c9920a] transition-colors placeholder:text-[#9ca3af]"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-5 py-2.5 hover:bg-[#b07d08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" /> {sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard className="p-4">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
            Your Auditor
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f0f4f8] flex items-center justify-center font-mono text-xs font-bold text-[#c9920a] flex-shrink-0">
              AIC
            </div>
            <div>
              <div className="text-xs font-semibold text-[#0f1f3d]">System Auditor</div>
              <div className="font-mono text-[9px] text-[#c9920a]">AI Integrity Certification</div>
            </div>
          </div>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Your assigned auditor will respond within 2 business days.
          </p>
        </SectionCard>

        <SectionCard className="p-4">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
            Communication Rules
          </div>
          <div className="space-y-3">
            {RULES.map((rule) => (
              <div key={rule} className="flex gap-2 items-start">
                <Info className="w-3.5 h-3.5 text-[#c9920a] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-[#6b7280] leading-relaxed">{rule}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
