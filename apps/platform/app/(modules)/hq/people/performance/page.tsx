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
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Performance Registry</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Quantifying excellence within the AIC accountability guild.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-gray-600 first-cap mb-2">Guild Health</p>
                    <div className="text-2xl font-serif text-[#0e1b2c] first-cap">A+ Tier</div>
                </div>
            </div>

            <div className="bg-white border border-[#dde2e8] rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left">
                    <thead className="bg-[#f5f7f9] border-b border-[#dde2e8] text-[12px] font-bold text-gray-500 first-cap">
                        <tr>
                            <th className="p-5 md:p-8">Personnel</th>
                            <th className="p-5 md:p-8">Audits Completed</th>
                            <th className="p-5 md:p-8">Quality Pass Rate</th>
                            <th className="p-5 md:p-8">Avg Response</th>
                            <th className="p-5 md:p-8 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e9ee] font-serif">
                        {staff.map((p, i) => (
                            <motion.tr 
                                key={p.name}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="hover:bg-[#eef1f5] transition-colors group"
                            >
                                <td className="p-5 md:p-8">
                                    <p className="text-lg font-bold text-[#0e1b2c] tracking-tight">{p.name}</p>
                                    <p className="text-[12px] text-gray-600 first-cap tracking-tighter mt-1">{p.role}</p>
                                </td>
                                <td className="p-5 md:p-8 text-[#0e1b2c] font-mono font-bold">{p.audits}</td>
                                <td className="p-5 md:p-8">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[#8a6a1f] font-mono font-bold">{p.quality}%</span>
                                        <div className="w-16 h-1 bg-[#f5f7f9] rounded-full overflow-hidden">
                                            <div className="h-full bg-aic-gold" style={{ width: `${p.quality}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 md:p-8 text-gray-500 font-mono text-xs">{p.time}</td>
                                <td className="p-5 md:p-8 text-right">
                                    <span className="px-3 py-1 rounded-full border border-green-200 text-green-700 text-[12px] font-bold first-cap">
                                        Active
                                    </span>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table></div>
            </div>

            <div className="mt-12 p-6 md:p-12 bg-[#f5f7f9] border border-dashed border-[#dde2e8] rounded-[3rem] text-center">
                <p className="text-gray-600 font-serif italic text-sm mb-0 leading-relaxed max-w-xl mx-auto">
                    Guild status is recalculated every 24 hours based on cross-departmental telemetry from Operations and the Intelligence Core.
                </p>
            </div>
        </div>
    );
}
