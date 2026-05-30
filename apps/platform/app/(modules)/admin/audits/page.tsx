'use client'

import { useState, useEffect } from 'react'
import AdminShell from '../components/AdminShell'
import { toast } from 'sonner'

interface Audit {
  id: string
  org_id: string
  org_name: string
  auditor_id?: string
  auditor_name?: string
  scheduled_at: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  findings?: number
  updated_at?: string
  created_at: string
}

interface Organization {
  id: string
  name: string
  tier: string
}

interface Auditor {
  id: string
  name: string
}

export default function AuditsPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [audits, setAudits] = useState<Audit[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [auditors, setAuditors] = useState<Auditor[]>([])
  const [loading, setLoading] = useState(true)
  const [isScheduling, setIsScheduling] = useState(false)
  
  // Form state
  const [newAudit, setNewAudit] = useState({
    org_id: '',
    auditor_id: '',
    scheduled_at: '',
    notes: ''
  })

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audits')
      const data = await res.json()
      setAudits(data.audits || [])
    } catch {
      toast.error('Failed to fetch scheduled audits')
    } finally {
      setLoading(false)
    }
  }

  const fetchMetadata = async () => {
    try {
      const [orgRes, audRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/auditors')
      ])
      const orgData = await orgRes.json()
      const audData = await audRes.json()
      setOrganizations(orgData.organizations || [])
      setAuditors(audData.auditors || [])
    } catch (err) {
      console.error('Metadata fetch failed', err)
    }
  }

  useEffect(() => {
    fetchAudits()
    fetchMetadata()
  }, [])

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAudit)
      })
      if (res.ok) {
        toast.success('Audit scheduled successfully')
        setIsScheduling(false)
        setNewAudit({ org_id: '', auditor_id: '', scheduled_at: '', notes: '' })
        fetchAudits()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to schedule audit')
      }
    } catch {
      toast.error('Network error while scheduling audit')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/audits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        toast.success(`Audit status updated to ${status}`)
        fetchAudits()
      }
    } catch {
      toast.error('Failed to update audit status')
    }
  }

  const upcoming = audits.filter(a => a.status === 'SCHEDULED')
  const inProgress = audits.filter(a => a.status === 'IN_PROGRESS')
  const completed = audits.filter(a => a.status === 'COMPLETED')

  return (
    <AdminShell>
      <div className="space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Scheduled</p>
            <p className="text-3xl font-bold text-yellow-500">{upcoming.length}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">In Progress</p>
            <p className="text-3xl font-bold text-blue-500">{inProgress.length}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Completed (YTD)</p>
            <p className="text-3xl font-bold text-green-500">{completed.length}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Findings (YTD)</p>
            <p className="text-3xl font-bold">
              {completed.reduce((sum, a) => sum + (a.findings || 0), 0)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                view === 'list' ? 'bg-blue-600 text-aic-paper' : 'bg-gray-800 text-gray-400'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                view === 'calendar' ? 'bg-blue-600 text-aic-paper' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Calendar View
            </button>
          </div>
          <button 
            onClick={() => setIsScheduling(true)}
            className="bg-blue-600 text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500"
          >
            + Schedule New Audit
          </button>
        </div>

        {/* Schedule Modal */}
        {isScheduling && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-[#1c1c1c] border border-gray-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-6">Schedule Institutional Audit</h3>
              <form onSubmit={handleCreateAudit} className="space-y-6">
                <div>
                  <label className="block text-xs text-gray-500 uppercase font-mono mb-2">Target Organization</label>
                  <select 
                    required
                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                    value={newAudit.org_id}
                    onChange={e => setNewAudit(prev => ({ ...prev, org_id: e.target.value }))}
                  >
                    <option value="">Select Organization...</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name} ({org.tier})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase font-mono mb-2">Lead Auditor</label>
                  <select 
                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                    value={newAudit.auditor_id}
                    onChange={e => setNewAudit(prev => ({ ...prev, auditor_id: e.target.value }))}
                  >
                    <option value="">Assign Later...</option>
                    {auditors.map(aud => (
                      <option key={aud.id} value={aud.id}>{aud.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase font-mono mb-2">Scheduled Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                    value={newAudit.scheduled_at}
                    onChange={e => setNewAudit(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase font-mono mb-2">Administrative Notes</label>
                  <textarea 
                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                    rows={3}
                    placeholder="Audit scope and focal areas..."
                    value={newAudit.notes}
                    onChange={e => setNewAudit(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsScheduling(false)}
                    className="text-gray-400 hover:text-aic-paper px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-blue-600 text-aic-paper px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors"
                  >
                    CONFIRM_SCHEDULE
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Sections */}
        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center text-gray-500 italic">Synchronizing institutional audit registry...</div>
          ) : (
            <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                Active Audits
              </h3>
              <div className="grid gap-4">
                {inProgress.map((audit) => (
                  <div
                    key={audit.id}
                    className="bg-[#1c1c1c] rounded-xl border border-blue-800/50 p-6"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-[10px] text-gray-500">{audit.id}</p>
                        <h4 className="text-xl font-bold mt-1">{audit.org_name}</h4>
                        <p className="text-sm text-gray-400 mt-1 italic">
                          Assigned: {audit.auditor_name || 'UNASSIGNED'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-400`}>
                          IN_PROGRESS
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button 
                        onClick={() => handleStatusChange(audit.id, 'COMPLETED')}
                        className="bg-green-600 text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500"
                      >
                        Complete Audit
                      </button>
                      <button className="text-gray-400 px-4 py-2 text-sm hover:text-gray-300">
                        View Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-yellow-500">Upcoming Schedule</h3>
            <div className="bg-[#1c1c1c] rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900/50 text-gray-500 text-[10px] font-mono uppercase tracking-widest">
                  <tr>
                    <th className="text-left p-4">Organization</th>
                    <th className="text-left p-4">Auditor</th>
                    <th className="text-left p-4">Scheduled Date</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {upcoming.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic">No audits scheduled for this period.</td></tr>
                  ) : upcoming.map((audit) => (
                    <tr key={audit.id} className="hover:bg-gray-800/30">
                      <td className="p-4 font-medium">{audit.org_name}</td>
                      <td className="p-4 text-sm">{audit.auditor_name || 'UNASSIGNED'}</td>
                      <td className="p-4 text-sm font-mono">{new Date(audit.scheduled_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleStatusChange(audit.id, 'IN_PROGRESS')}
                            className="text-blue-400 hover:text-blue-300 text-[10px] font-bold font-mono"
                          >
                            START_NOW
                          </button>
                          <button 
                            onClick={() => handleStatusChange(audit.id, 'CANCELLED')}
                            className="text-gray-500 hover:text-red-400 text-[10px] font-bold font-mono"
                          >
                            CANCEL
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Completed */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-green-500">Audit History</h3>
            <div className="bg-[#1c1c1c] rounded-xl border border-gray-800 overflow-hidden text-gray-400">
              <table className="w-full">
                <thead className="bg-gray-900/50 text-gray-500 text-[10px] font-mono uppercase tracking-widest">
                  <tr>
                    <th className="text-left p-4">Organization</th>
                    <th className="text-left p-4">Auditor</th>
                    <th className="text-left p-4">Completed On</th>
                    <th className="text-left p-4">Findings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {completed.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic">No completed audits in historical registry.</td></tr>
                  ) : completed.map((audit) => (
                    <tr key={audit.id} className="hover:bg-gray-800/30">
                      <td className="p-4 font-medium text-aic-paper">{audit.org_name}</td>
                      <td className="p-4 text-sm">{audit.auditor_name}</td>
                      <td className="p-4 text-sm font-mono">{new Date(audit.updated_at || audit.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold font-mono text-green-500 bg-green-500/10 px-2 py-1 rounded">
                          CERTIFIED_COMPLIANT
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
