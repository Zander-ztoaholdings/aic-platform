'use client';

import { motion } from 'framer-motion';

export default function RegulatoryStackPage() {
    const laws = [
        { id: 'popia_71', name: 'POPIA Section 71', status: 'CORE', impact: 'High', interpretation: 'Prohibits solely automated decisions with legal effect.' },
        { id: 'const_10', name: 'Constitution Sec 10', status: 'ACTIVE', impact: 'Critical', interpretation: 'Inherent dignity must be protected.' },
        { id: 'cpa_2008', name: 'Consumer Protection Act', status: 'MONITORED', impact: 'Medium', interpretation: 'Right to fair, just and reasonable terms.' },
        { id: 'paia_2000', name: 'PAIA', status: 'ACTIVE', impact: 'High', interpretation: 'Right to access information held by private bodies.' }
    ];

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end">
                <div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#0e1b2c] tracking-tight mb-4 tracking-tighter">Regulatory Stack</h1>
                    <p className="text-gray-500 font-serif italic text-lg leading-relaxed max-w-2xl">
                        The definitive legal foundation for AI accountability in South Africa.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-[#8a6a1f] first-cap mb-2">Legal Health</p>
                    <div className="text-3xl md:text-4xl font-serif">100% Sync</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {laws.map((law, i) => (
                    <motion.div 
                        key={law.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#dde2e8] p-5 md:p-8 rounded-[2rem] flex items-center justify-between group hover:border-aic-gold/30 transition-all"
                    >
                        <div className="flex items-center gap-8">
                            <span className="font-mono text-xs text-gray-600">0{i+1}</span>
                            <div>
                                <h3 className="text-xl font-serif font-bold text-[#0e1b2c] group-hover:text-[#8a6a1f] transition-colors">{law.name}</h3>
                                <p className="text-sm text-gray-500 italic mt-1">{law.interpretation}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-12">
                            <div className="text-right">
                                <p className="text-[12px] text-gray-600 first-cap mb-1">Impact Level</p>
                                <p className="text-[12px] font-bold text-[#0e1b2c] first-cap">{law.impact}</p>
                            </div>
                            <span className="px-4 py-1.5 rounded-full bg-[#f5f7f9] border border-[#dde2e8] text-[11px] font-bold tracking-widest text-[#8a6a1f]">
                                {law.status}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-6 md:p-12 bg-[#f5f7f9] border border-[#dde2e8] rounded-[3rem] text-center">
                <p className="text-gray-500 font-serif italic text-sm mb-8 max-w-xl mx-auto leading-relaxed">
                    All interpretative notes are verified against the 2026 High Court precedents on algorithmic agency.
                </p>
                <button className="bg-[#0e1b2c] text-white px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-2xl">
                    DOWNLOAD LEGAL HANDBOOK
                </button>
            </div>
        </div>
    );
}
