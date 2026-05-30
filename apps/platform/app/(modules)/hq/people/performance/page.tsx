'use client';

import { motion } from 'framer-motion';

export default function PerformanceRegistryPage() {
    const staff = [
        { name: 'Dr. Sarah Khumalo', role: 'Lead Auditor', audits: 142, quality: 99.8, time: '4.2h' },
        { name: 'Zander Wilken', role: 'Principal Officer', audits: 12, quality: 100, time: '1.5h' },
        { name: 'Auditor #04', role: 'Junior Auditor', audits: 45, quality: 94.2, time: '12.8h' }
    ];

    return (
        <div className="space-y-16">
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Performance Registry</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Quantifying excellence within the AIC accountability guild.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.4em] mb-2">Guild Health</p>
                    <div className="text-2xl font-serif text-aic-paper uppercase tracking-widest">A+ Tier</div>
                </div>
            </div>

            <div className="bg-[#080808] border border-aic-paper/5 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-aic-paper/[0.02] border-b border-aic-paper/5 font-mono text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em]">
                        <tr>
                            <th className="p-8">Personnel</th>
                            <th className="p-8">Audits Completed</th>
                            <th className="p-8">Quality Pass Rate</th>
                            <th className="p-8">Avg Response</th>
                            <th className="p-8 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-aic-paper/5 font-serif">
                        {staff.map((p, i) => (
                            <motion.tr 
                                key={p.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="hover:bg-aic-paper/[0.01] transition-colors group"
                            >
                                <td className="p-8">
                                    <p className="text-lg font-bold text-aic-paper tracking-tight">{p.name}</p>
                                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-tighter mt-1">{p.role}</p>
                                </td>
                                <td className="p-8 text-aic-paper font-mono font-bold">{p.audits}</td>
                                <td className="p-8">
                                    <div className="flex items-center gap-3">
                                        <span className="text-aic-gold font-mono font-bold">{p.quality}%</span>
                                        <div className="w-16 h-1 bg-aic-paper/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-aic-gold" style={{ width: `${p.quality}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="p-8 text-gray-400 font-mono text-xs">{p.time}</td>
                                <td className="p-8 text-right">
                                    <span className="px-3 py-1 rounded-full border border-green-500/20 text-green-500 text-[8px] font-mono font-bold uppercase tracking-widest">
                                        Active
                                    </span>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 p-12 bg-aic-paper/[0.01] border border-dashed border-aic-paper/5 rounded-[3rem] text-center">
                <p className="text-gray-600 font-serif italic text-sm mb-0 leading-relaxed max-w-xl mx-auto">
                    Guild status is recalculated every 24 hours based on cross-departmental telemetry from Operations and the Intelligence Core.
                </p>
            </div>
        </div>
    );
}
