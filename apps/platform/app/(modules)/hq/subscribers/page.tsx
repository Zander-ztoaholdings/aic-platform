'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/subscribers')
      .then(res => res.json())
      .then(data => {
        setSubscribers(data.subscribers || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
      <div className="max-w-5xl space-y-12">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end">
            <div>
                <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight underline decoration-aic-gold underline-offset-8">The Pulse Community</h1>
                <p className="text-gray-500 font-serif mt-4 italic text-lg max-w-xl">Managing the citizen newsletter list and outreach engagement.</p>
            </div>
            <button className="bg-[#0e1b2c] text-white px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-colors">
                Export CSV
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="bg-white border border-[#dde2e8] p-5 md:p-8 rounded-[2rem] flex items-center justify-between">
                <div>
                    <p className="text-[12px] text-gray-500 first-cap mb-2">Total Subscribers</p>
                    <p className="text-3xl md:text-4xl font-serif font-medium text-[#0e1b2c]">{subscribers.length}</p>
                </div>
                <div className="text-right">
                    <span className="text-[11px] font-mono text-green-700 bg-green-50 px-2 py-1 rounded">GROWING</span>
                </div>
            </div>
            <div className="bg-[#f5f7f9] border border-[#dde2e8] p-5 md:p-8 rounded-[2rem]">
                <p className="text-[12px] text-gray-500 first-cap mb-2">Engagement Rate</p>
                <p className="text-3xl md:text-4xl font-serif font-medium text-[#8a6a1f]">84.2%</p>
            </div>
        </div>

        <div className="bg-white border border-[#dde2e8] rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left text-sm font-serif">
                <thead className="bg-[#f5f7f9] border-b border-[#dde2e8]">
                    <tr>
                        <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Email Address</th>
                        <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Join Date</th>
                        <th className="p-4 sm:p-6 text-right text-[12px] font-bold text-gray-500 first-cap">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e9ee]">
                    {loading ? (
                        <tr><td colSpan={3} className="p-6 md:p-12 text-center text-gray-500 font-serif italic">Syncing with community database...</td></tr>
                    ) : subscribers.length === 0 ? (
                        <tr><td colSpan={3} className="p-6 md:p-12 text-center text-gray-500 font-serif">No active subscribers found.</td></tr>
                    ) : subscribers.map((sub, i) => (
                        <motion.tr 
                            key={sub.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="hover:bg-[#eef1f5] transition-colors group"
                        >
                            <td className="p-4 sm:p-6 text-[#0e1b2c] font-serif text-lg">{sub.email}</td>
                            <td className="p-4 sm:p-6 text-gray-500 font-mono text-xs">{new Date(sub.subscribed_at).toLocaleDateString()}</td>
                            <td className="p-4 sm:p-6 text-right">
                                <button className="text-[12px] font-bold first-cap text-gray-500 hover:text-aic-red transition-colors">Unsubscribe</button>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table></div>
        </div>
      </div>
  )
}
