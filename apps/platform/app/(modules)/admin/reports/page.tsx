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
          <button className="bg-[#0e1b2c] text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#22344a] transition-colors">
            Generate Custom Report
          </button>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {reportCategories.map((cat) => (
            <div key={cat.title} className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
              <p className="text-gray-500 text-xs first-cap mb-2">{cat.title}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold">{cat.value}</p>
                <span className={cat.trend.startsWith('-') ? 'text-green-700 text-xs' : 'text-red-700 text-xs'}>
                  {cat.trend}
                </span>
              </div>
              <p className="text-gray-500 text-sm font-serif">{cat.desc}</p>
            </div>
          ))}
        </div>

        {/* Report Queue */}
        <div className="bg-white rounded-xl border border-[#dde2e8] overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-[#dde2e8] bg-white">
            <h2 className="font-bold">Recent Generated Reports</h2>
          </div>
          <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-white text-gray-500 first-cap text-xs">
              <tr>
                <th className="p-4">Report Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Generated Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e9ee]">
              {recentReports.map((report) => (
                <tr key={report.id} className="hover:bg-[#eef1f5] transition-colors">
                  <td className="p-4 font-medium">{report.name}</td>
                  <td className="p-4">
                    <span className="bg-[#f5f7f9] px-2 py-1 rounded text-[11.5px] text-gray-500 font-mono">
                      {report.type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{report.date}</td>
                  <td className="p-4 text-right">
                    <button className="text-blue-700 hover:text-blue-700 text-xs">
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        {/* Visual Placeholder for Charts */}
        <div className="h-64 bg-white rounded-xl border border-[#dde2e8] border-dashed flex items-center justify-center">
          <div className="text-center">
            <span className="text-3xl md:text-4xl block mb-2">📊</span>
            <p className="text-gray-500 text-xs first-cap">Interactive Visualization Engine Offline</p>
            <p className="text-gray-600 text-[11.5px] mt-1 italic">Waiting for more data points from active certifications</p>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
