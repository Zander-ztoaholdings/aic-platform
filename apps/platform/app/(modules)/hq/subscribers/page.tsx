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
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-4xl font-serif font-medium tracking-tight underline decoration-aic-gold underline-offset-8">The Pulse Community</h1>
                <p className="text-gray-500 font-serif mt-4 italic text-lg max-w-xl">Managing the citizen newsletter list and outreach engagement.</p>
            </div>
            <button className="bg-aic-paper text-black px-8 py-3 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-colors">
                Export CSV
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-black/40 border border-aic-paper/5 p-8 rounded-[2rem] flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Total Subscribers</p>
                    <p className="text-4xl font-serif font-medium text-aic-paper">{subscribers.length}</p>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-mono text-green-400 bg-green-400/10 px-2 py-1 rounded">GROWING</span>
                </div>
            </div>
            <div className="bg-aic-paper/5 border border-aic-paper/5 p-8 rounded-[2rem]">
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Engagement Rate</p>
                <p className="text-4xl font-serif font-medium text-aic-gold">84.2%</p>
            </div>
        </div>

        <div className="bg-black/40 border border-aic-paper/5 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-sm font-serif">
                <thead className="bg-aic-paper/5 border-b border-aic-paper/5">
                    <tr>
                        <th className="p-6 font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Email Address</th>
                        <th className="p-6 font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Join Date</th>
                        <th className="p-6 text-right font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-aic-paper/5">
                    {loading ? (
                        <tr><td colSpan={3} className="p-12 text-center text-gray-500 font-serif italic">Syncing with community database...</td></tr>
                    ) : subscribers.length === 0 ? (
                        <tr><td colSpan={3} className="p-12 text-center text-gray-500 font-serif">No active subscribers found.</td></tr>
                    ) : subscribers.map((sub, i) => (
                        <motion.tr 
                            key={sub.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="hover:bg-aic-paper/5 transition-colors group"
                        >
                            <td className="p-6 text-aic-paper font-serif text-lg">{sub.email}</td>
                            <td className="p-6 text-gray-500 font-mono text-xs">{new Date(sub.subscribed_at).toLocaleDateString()}</td>
                            <td className="p-6 text-right">
                                <button className="text-[10px] font-mono font-bold uppercase text-gray-500 hover:text-aic-red transition-colors tracking-widest">Unsubscribe</button>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
  )
}
