'use client'

import { useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'

type Lead = {
  id: string
  email: string
  company?: string
  score?: number
  source: string
  status: string
  created_at: string
}

type ConvertModal = {
  lead: Lead
  orgName: string
  tier: string
  contactEmail: string
  loading: boolean
  error: string
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ConvertModal | null>(null)

  const fetchLeads = () => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => { setLeads(data.leads || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchLeads() }, [])

  const highIntentLeads = leads.filter(l => (l.score || 0) > 70).length

  const openConvertModal = (lead: Lead) => {
    setModal({
      lead,
      orgName: lead.company || '',
      tier: 'TIER_3',
      contactEmail: lead.email,
      loading: false,
      error: '',
    })
  }

  const handleConvert = async () => {
    if (!modal) return
    setModal(m => m ? { ...m, loading: true, error: '' } : null)

    try {
      const res = await fetch(`/api/v1/hq/leads/${modal.lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: modal.orgName,
          tier: modal.tier,
          contactEmail: modal.contactEmail,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setModal(m => m ? { ...m, loading: false, error: data.error || 'Conversion failed.' } : null)
        return
      }

      setModal(null)
      fetchLeads()
    } catch {
      setModal(m => m ? { ...m, loading: false, error: 'Network error.' } : null)
    }
  }

  const handleAddLead = async () => {
    const company = prompt("Enter Organization Name:")
    const email = prompt("Enter Primary Contact Email:")
    if (!email) return

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, status: 'PROSPECT' })
      })
      if (response.ok) fetchLeads()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold">Inbound Leads</h1>
            <p className="text-gray-500 font-serif mt-1 text-sm italic">Prospective organizations captured via Self-Assessment and Contact forms.</p>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleAddLead}
              className="bg-blue-600 text-aic-paper px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-blue-500 transition-all"
            >
              + Add Outreach Target
            </button>
            <div className="text-right border-l border-gray-800 pl-6">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Total Leads</p>
              <p className="text-2xl font-bold">{leads.length}</p>
            </div>
            <div className="text-right border-l border-gray-800 pl-4">
              <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">High Intent (&gt;70)</p>
              <p className="text-2xl font-bold text-blue-400">{highIntentLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1c1c1c] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Score</th>
                <th className="p-4">Source</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Scanning leads...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No inbound leads found.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-800/30 transition-colors group">
                    <td className="p-4 font-medium text-aic-paper">{lead.email}</td>
                    <td className="p-4 text-gray-400">{lead.company || '—'}</td>
                    <td className="p-4">
                      {lead.score ? (
                        <span className={`font-mono font-bold ${lead.score > 70 ? 'text-blue-400' : 'text-gray-500'}`}>
                          {lead.score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      <span className="bg-gray-800 px-2 py-0.5 rounded text-[10px] font-mono uppercase text-gray-400">
                        {lead.source}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === 'ALPHA_APPLIED' ? 'text-aic-gold' :
                        lead.status === 'CONVERTED' ? 'text-green-400' :
                        lead.status === 'RE-ENGAGED' ? 'text-purple-400' :
                        'text-green-500'
                      }`}>
                        {lead.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {lead.status !== 'CONVERTED' && (
                          <button
                            onClick={() => openConvertModal(lead)}
                            className="bg-aic-gold text-black px-3 py-1 rounded hover:bg-yellow-400 transition-all text-[10px] font-bold uppercase tracking-widest"
                          >
                            Convert to Org
                          </button>
                        )}
                        <button className="text-blue-400 hover:text-blue-300 text-xs">Email</button>
                        <button className="text-gray-500 hover:text-aic-paper text-xs">Detail</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert to Organisation Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-8 w-full max-w-md space-y-5">
            <div>
              <h2 className="text-lg font-bold text-aic-paper">Convert Lead to Organisation</h2>
              <p className="text-gray-500 text-sm mt-1">
                This will create an organisation record, generate an invite link, and send it to the contact email.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block mb-1">
                  Organisation Name
                </label>
                <input
                  type="text"
                  value={modal.orgName}
                  onChange={e => setModal(m => m ? { ...m, orgName: e.target.value } : null)}
                  className="w-full bg-[#1c1c1c] border border-gray-700 rounded-lg px-3 py-2 text-sm text-aic-paper focus:outline-none focus:border-aic-gold"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block mb-1">
                  Certification Tier
                </label>
                <select
                  value={modal.tier}
                  onChange={e => setModal(m => m ? { ...m, tier: e.target.value } : null)}
                  className="w-full bg-[#1c1c1c] border border-gray-700 rounded-lg px-3 py-2 text-sm text-aic-paper focus:outline-none focus:border-aic-gold"
                >
                  <option value="TIER_1">Tier 1 — Enterprise</option>
                  <option value="TIER_2">Tier 2 — Mid-Market</option>
                  <option value="TIER_3">Tier 3 — SME</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest block mb-1">
                  Invite Email
                </label>
                <input
                  type="email"
                  value={modal.contactEmail}
                  onChange={e => setModal(m => m ? { ...m, contactEmail: e.target.value } : null)}
                  className="w-full bg-[#1c1c1c] border border-gray-700 rounded-lg px-3 py-2 text-sm text-aic-paper focus:outline-none focus:border-aic-gold"
                  placeholder="contact@company.com"
                />
              </div>
            </div>

            {modal.error && (
              <p className="text-red-400 text-xs">{modal.error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-gray-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={modal.loading || !modal.orgName || !modal.contactEmail}
                className="flex-1 bg-aic-gold text-black px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-yellow-400 transition-all"
              >
                {modal.loading ? 'Converting...' : 'Convert & Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
