'use client'

import AdminShell from '../components/AdminShell'

export default function ReportsPage() {
  const reportCategories = [
    { title: 'Certification Velocity', value: '4.2 weeks', trend: '-12%', desc: 'Average time from application to seal.' },
    { title: 'Bias Incidence Rate', value: '1.8%', trend: '+0.2%', desc: 'Flagged decisions across all Tier 1 systems.' },
    { title: 'Regulatory Coverage', value: '84%', trend: '+5%', desc: 'Section 71 compliance density in audited orgs.' },
  ]

  const recentReports = [
    { id: 1, name: 'Monthly Integrity Summary - Jan 2026', date: 'Feb 1, 2026', type: 'SYSTEM' },
    { id: 2, name: 'Industry Benchmark: Banking Sector', date: 'Jan 28, 2026', type: 'ANALYTICS' },
    { id: 3, name: 'Information Regulator Compliance Audit', date: 'Jan 15, 2026', type: 'REGULATORY' },
  ]

  return (
    <AdminShell>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">System Analytics & Reports</h1>
          <button className="bg-blue-600 text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">
            Generate Custom Report
          </button>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reportCategories.map((cat) => (
            <div key={cat.title} className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">{cat.title}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold">{cat.value}</p>
                <span className={cat.trend.startsWith('-') ? 'text-green-500 text-xs' : 'text-red-500 text-xs'}>
                  {cat.trend}
                </span>
              </div>
              <p className="text-gray-400 text-sm font-serif">{cat.desc}</p>
            </div>
          ))}
        </div>

        {/* Report Queue */}
        <div className="bg-[#1c1c1c] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-800 bg-gray-900/30">
            <h2 className="font-bold">Recent Generated Reports</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="p-4">Report Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Generated Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-4 font-medium">{report.name}</td>
                  <td className="p-4">
                    <span className="bg-gray-800 px-2 py-1 rounded text-[10px] text-gray-400 font-mono">
                      {report.type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{report.date}</td>
                  <td className="p-4 text-right">
                    <button className="text-blue-400 hover:text-blue-300 text-xs">
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Visual Placeholder for Charts */}
        <div className="h-64 bg-[#1c1c1c] rounded-xl border border-gray-800 border-dashed flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl block mb-2">📊</span>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Interactive Visualization Engine Offline</p>
            <p className="text-gray-600 text-[10px] mt-1 italic">Waiting for more data points from active certifications</p>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
