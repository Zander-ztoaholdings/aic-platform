'use client'

import { useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/applications')
      .then(res => res.json())
      .then(data => {
        setApplications(data.applications || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Alpha Program Applications</h1>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">{applications.length} Total</p>
        </div>

        <div className="bg-[#1c1c1c] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="p-4">Applicant</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Use Case</th>
                <th className="p-4">Submitted</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Loading applications...</td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No applications in queue.</td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-aic-paper">{app.first_name} {app.last_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{app.email}</p>
                    </td>
                    <td className="p-4">{app.company}</td>
                    <td className="p-4">
                      <p className="text-xs text-gray-400 line-clamp-2 max-w-md">{app.use_case}</p>
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="text-blue-400 hover:text-blue-300 text-xs">
                          Review
                        </button>
                        <button className="text-gray-500 hover:text-aic-paper text-xs">
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}