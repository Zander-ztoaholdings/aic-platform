'use client'
import { PageHeader } from '@/app/components/ui/PageHeader';

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
        <PageHeader eyebrow="Assessments" title="Audits" lede="Scheduled and completed audits across client organisations, and who is assigned to each." />
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Scheduled</p>
            <p className="font-serif text-[28px] font-semibold text-[#0e1b2c]">{upcoming.length}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">In Progress</p>
            <p className="font-serif text-[28px] font-semibold text-[#0e1b2c]">{inProgress.length}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Completed (YTD)</p>
            <p className="font-serif text-[28px] font-semibold text-[#0e1b2c]">{completed.length}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Findings (YTD)</p>
            <p className="font-serif text-[28px] font-semibold text-[#0e1b2c]">
              {completed.reduce((sum, a) => sum + (a.findings || 0), 0)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                view === 'list' ? 'bg-[#0e1b2c] text-aic-paper' : 'bg-[#f5f7f9] text-gray-500'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                view === 'calendar' ? 'bg-[#0e1b2c] text-aic-paper' : 'bg-[#f5f7f9] text-gray-500'
              }`}
            >
              Calendar
            </button>
          </div>
          <button 
            onClick={() => setIsScheduling(true)}
            className="bg-[#0e1b2c] text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#22344a]"
          >
            + Schedule New Audit
          </button>
        </div>

        {/* Schedule Modal */}
        {isScheduling && (
          <div className="fixed inset-0 bg-white backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white border border-[#dde2e8] rounded-2xl p-5 md:p-8 max-w-lg w-full">
              <h3 className="text-xl font-bold mb-6">Schedule Institutional Audit</h3>
              <form onSubmit={handleCreateAudit} className="space-y-6">
                <div>
                  <label className="block text-xs text-gray-500 first-cap mb-2">Target Organization</label>
                  <select 
                    required
                    className="w-full bg-white border border-[#dde2e8] rounded-lg p-3 text-sm focus:border-blue-200 outline-none"
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
                  <label className="block text-xs text-gray-500 first-cap mb-2">Lead Auditor</label>
                  <select 
                    className="w-full bg-white border border-[#dde2e8] rounded-lg p-3 text-sm focus:border-blue-200 outline-none"
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
                  <label className="block text-xs text-gray-500 first-cap mb-2">Scheduled Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-white border border-[#dde2e8] rounded-lg p-3 text-sm focus:border-blue-200 outline-none"
                    value={newAudit.scheduled_at}
                    onChange={e => setNewAudit(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 first-cap mb-2">Administrative Notes</label>
                  <textarea 
                    className="w-full bg-white border border-[#dde2e8] rounded-lg p-3 text-sm focus:border-blue-200 outline-none"
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
                    className="text-gray-500 hover:text-[#0e1b2c] px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-[#0e1b2c] text-aic-paper px-4 sm:px-6 py-2 rounded-lg text-sm font-bold hover:bg-[#22344a] transition-colors"
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
            <div className="py-10 text-sm text-[#5e6b7b]">Loading…</div>
          ) : (
            <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-700">
                <span className="w-2 h-2 rounded-full bg-[#0e1b2c] animate-pulse"></span>
                Active Audits
              </h3>
              <div className="grid gap-4">
                {inProgress.map((audit) => (
                  <div
                    key={audit.id}
                    className="bg-white rounded-xl border border-blue-200 p-4 sm:p-6"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-[11.5px] text-gray-500">{audit.id}</p>
                        <h4 className="text-xl font-bold mt-1">{audit.org_name}</h4>
                        <p className="text-sm text-gray-500 mt-1 italic">
                          Assigned: {audit.auditor_name || 'UNASSIGNED'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-[12px] font-bold first-cap bg-blue-50 text-blue-700`}>
                          In progress
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
                      <button className="text-gray-500 px-4 py-2 text-sm hover:text-gray-700">
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
            <h3 className="text-base font-semibold mb-3 text-[#0e1b2c]">Upcoming</h3>
            <div className="bg-white rounded-xl border border-[#dde2e8] overflow-hidden">
              <div className="overflow-x-auto"><table className="min-w-[640px] w-full">
                <thead className="bg-white text-gray-500 text-[12px] first-cap">
                  <tr>
                    <th className="text-left p-4">Organization</th>
                    <th className="text-left p-4">Auditor</th>
                    <th className="text-left p-4">Scheduled Date</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e9ee]">
                  {upcoming.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 md:p-10 text-center text-sm text-[#5e6b7b]">No audits scheduled for this period.</td></tr>
                  ) : upcoming.map((audit) => (
                    <tr key={audit.id} className="hover:bg-[#eef1f5]">
                      <td className="p-4 font-medium">{audit.org_name}</td>
                      <td className="p-4 text-sm">{audit.auditor_name || 'UNASSIGNED'}</td>
                      <td className="p-4 text-sm font-mono">{new Date(audit.scheduled_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleStatusChange(audit.id, 'IN_PROGRESS')}
                            className="text-blue-700 hover:text-blue-700 text-[11.5px] font-bold font-mono"
                          >
                            START_NOW
                          </button>
                          <button 
                            onClick={() => handleStatusChange(audit.id, 'CANCELLED')}
                            className="text-gray-500 hover:text-red-700 text-[11.5px] font-bold font-mono"
                          >
                            CANCEL
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>

          {/* Completed */}
          <div>
            <h3 className="text-base font-semibold mb-3 text-[#0e1b2c]">Completed</h3>
            <div className="bg-white rounded-xl border border-[#dde2e8] overflow-hidden text-gray-500">
              <div className="overflow-x-auto"><table className="min-w-[640px] w-full">
                <thead className="bg-white text-gray-500 text-[12px] first-cap">
                  <tr>
                    <th className="text-left p-4">Organization</th>
                    <th className="text-left p-4">Auditor</th>
                    <th className="text-left p-4">Completed On</th>
                    <th className="text-left p-4">Findings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e9ee]">
                  {completed.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 md:p-10 text-center text-sm text-[#5e6b7b]">No completed audits yet.</td></tr>
                  ) : completed.map((audit) => (
                    <tr key={audit.id} className="hover:bg-[#eef1f5]">
                      <td className="p-4 font-medium text-[#0e1b2c]">{audit.org_name}</td>
                      <td className="p-4 text-sm">{audit.auditor_name}</td>
                      <td className="p-4 text-sm font-mono">{new Date(audit.updated_at || audit.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className="text-[11.5px] font-bold font-mono text-[#0e1b2c] bg-green-50 px-2 py-1 rounded">
                          CERTIFIED_COMPLIANT
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
