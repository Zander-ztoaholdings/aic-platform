'use client';

import { motion } from 'framer-motion';

export default function SADCRegionalPage() {
    const jurisdictions = [
        { 
            country: "South Africa", 
            law: "POPIA Section 71", 
            status: "OPERATIONAL", 
            parity: 1.0,
            notes: "Gold standard baseline. Strict prohibition on automated processing without meaningful oversight."
        },
        { 
            country: "Mauritius", 
            law: "Data Protection Act 2017", 
            status: "MAPPED", 
            parity: 0.85,
            notes: "Strong alignment with GDPR. Section 38 mandates right to human intervention."
        },
        { 
            country: "Botswana", 
            law: "Data Protection Act 2018", 
            status: "IN_PROGRESS", 
            parity: 0.70,
            notes: "Enforcement began 2021. Requires mapping of Section 20 automated processing rights."
        },
        { 
            country: "Namibia", 
            law: "Cybercrime & Data Bill", 
            status: "MONITORED", 
            parity: 0.40,
            notes: "Bill pending final gazetting. Early alignment with SADC model law detected."
        }
    ];

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">SADC Regional Mapping</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Harmonizing AIC methodology across the Southern African Development Community.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-2">Continental Coverage</p>
                    <div className="text-4xl font-serif text-aic-paper">4 Jurisdictions</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {jurisdictions.map((item, i) => (
                    <motion.div 
                        key={item.country}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-[#080808] border border-aic-paper/5 p-10 rounded-[2.5rem] flex items-center justify-between group hover:border-aic-gold/20 transition-all"
                    >
                        <div className="flex items-center gap-12 max-w-2xl">
                            <div className="w-16 h-16 rounded-2xl bg-aic-paper/[0.02] border border-aic-paper/5 flex items-center justify-center font-bold text-gray-600 text-xs">
                                0{i+1}
                            </div>
                            <div>
                                <h3 className="text-2xl font-serif font-bold text-aic-paper mb-2 group-hover:text-aic-gold transition-colors">{item.country}</h3>
                                <p className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-4">{item.law}</p>
                                <p className="text-sm font-serif italic text-gray-400 leading-relaxed">"{item.notes}"</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-16">
                            <div className="text-right">
                                <p className="text-[8px] font-mono text-gray-600 uppercase tracking-widest mb-2">AIC Parity</p>
                                <div className="text-2xl font-serif text-aic-paper">{(item.parity * 100).toFixed(0)}%</div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-widest ${
                                item.status === 'OPERATIONAL' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-aic-gold/10 text-aic-gold border-aic-gold/20'
                            }`}>
                                {item.status}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-12 bg-aic-paper/[0.02] border border-aic-paper/5 rounded-[3rem] text-center">
                <p className="text-gray-500 font-serif italic text-sm mb-8 leading-relaxed max-w-2xl mx-auto">
                    Our objective is a single AIC certification that satisfies all 16 SADC member state data protection authorities through Mutual Recognition Agreements (MRAs).
                </p>
                <button className="bg-aic-paper text-black px-10 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold transition-all shadow-2xl">
                    REQUEST REGIONAL LEGAL BRIEF
                </button>
            </div>
        </div>
    );
}
