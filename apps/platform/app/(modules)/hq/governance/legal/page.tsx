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
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-serif font-bold text-aic-paper tracking-tight mb-4 tracking-tighter">Regulatory Stack</h1>
                    <p className="text-gray-500 font-serif italic text-lg leading-relaxed max-w-2xl">
                        The definitive legal foundation for AI accountability in South Africa.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-2">Legal Health</p>
                    <div className="text-4xl font-serif">100% Sync</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {laws.map((law, i) => (
                    <motion.div 
                        key={law.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-[#080808] border border-aic-paper/5 p-8 rounded-[2rem] flex items-center justify-between group hover:border-aic-gold/30 transition-all"
                    >
                        <div className="flex items-center gap-8">
                            <span className="font-mono text-xs text-gray-600">0{i+1}</span>
                            <div>
                                <h3 className="text-xl font-serif font-bold text-aic-paper group-hover:text-aic-gold transition-colors">{law.name}</h3>
                                <p className="text-sm text-gray-500 italic mt-1">{law.interpretation}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-12">
                            <div className="text-right">
                                <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Impact Level</p>
                                <p className="text-[10px] font-bold text-aic-paper uppercase">{law.impact}</p>
                            </div>
                            <span className="px-4 py-1.5 rounded-full bg-aic-paper/5 border border-aic-paper/10 text-[9px] font-bold tracking-widest text-aic-gold">
                                {law.status}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-12 bg-aic-paper/5 border border-aic-paper/5 rounded-[3rem] text-center">
                <p className="text-gray-500 font-serif italic text-sm mb-8 max-w-xl mx-auto leading-relaxed">
                    All interpretative notes are verified against the 2026 High Court precedents on algorithmic agency.
                </p>
                <button className="bg-aic-paper text-black px-10 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold transition-all shadow-2xl">
                    DOWNLOAD LEGAL HANDBOOK
                </button>
            </div>
        </div>
    );
}
