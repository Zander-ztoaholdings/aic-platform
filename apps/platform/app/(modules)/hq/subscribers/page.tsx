'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Eyebrow, SectionCard } from '@/app/components/ui/Eyebrow'

type Subscriber = { id: string; email: string; status: string | null; subscribed_at: string | null }

const date = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/subscribers')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setSubscribers(data.subscribers || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  function exportCsv() {
    const rows = [['email', 'status', 'subscribed_at'], ...subscribers.map((s) => [s.email, s.status ?? '', s.subscribed_at ?? ''])]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `aic-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Eyebrow>HQ growth</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Newsletter subscribers</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            Everyone who signed up for The Pulse on the public site. Open and click rates are not measured here; they need the email
            provider’s reporting connected.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={subscribers.length === 0}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] transition-colors disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </header>

      <p className="text-sm text-[#0e1b2c]">
        {loading ? 'Loading…' : failed ? 'Could not load the list. Try refreshing.' : `${subscribers.length} ${subscribers.length === 1 ? 'subscriber' : 'subscribers'}.`}
      </p>

      {!loading && !failed && (
        <SectionCard className="p-0 overflow-hidden">
          {subscribers.length === 0 ? (
            <p className="p-5 text-sm text-[#5e6b7b]">Nobody has subscribed yet.</p>
          ) : (
            <ul className="divide-y divide-[#e6e9ee]">
              {subscribers.map((s) => (
                <li key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-5 py-3.5">
                  <span className="text-sm font-medium text-[#0e1b2c] break-all">{s.email}</span>
                  <span className="text-[13px] text-[#5e6b7b]">
                    {s.status ? `${s.status.charAt(0).toUpperCase()}${s.status.slice(1).toLowerCase()} · ` : ''}joined {date(s.subscribed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  )
}
