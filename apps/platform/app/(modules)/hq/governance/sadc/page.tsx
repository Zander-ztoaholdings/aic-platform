'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

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
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <Eyebrow>HQ regulation</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">SADC Regional Mapping</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                        Harmonizing AIC methodology across the Southern African Development Community.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-[#8a6a1f] first-cap mb-2">Continental Coverage</p>
                    <div className="text-3xl md:text-4xl font-serif text-[#0e1b2c]">4 Jurisdictions</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
                {jurisdictions.map((item, i) => (
                    <motion.div 
                        key={item.country}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#dde2e8] p-6 md:p-10 rounded-xl flex items-center justify-between group hover:border-aic-gold/20 transition-all"
                    >
                        <div className="flex items-center gap-12 max-w-2xl">
                            <div className="w-16 h-16 rounded-2xl bg-[#f5f7f9] border border-[#dde2e8] flex items-center justify-center font-bold text-gray-600 text-xs">
                                0{i+1}
                            </div>
                            <div>
                                <h3 className="text-2xl font-serif font-bold text-[#0e1b2c] mb-2 group-hover:text-[#8a6a1f] transition-colors">{item.country}</h3>
                                <p className="text-sm text-gray-500 first-cap mb-4">{item.law}</p>
                                <p className="text-sm font-serif italic text-gray-500 leading-relaxed">"{item.notes}"</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-16">
                            <div className="text-right">
                                <p className="text-[12px] text-gray-600 first-cap mb-2">AIC Parity</p>
                                <div className="text-2xl font-serif text-[#0e1b2c]">{(item.parity * 100).toFixed(0)}%</div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full border text-[12px] font-bold first-cap ${
                                item.status === 'OPERATIONAL' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-aic-gold/10 text-[#8a6a1f] border-aic-gold/20'
                            }`}>
                                {item.status}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-6 md:p-12 bg-[#f5f7f9] border border-[#dde2e8] rounded-xl text-center">
                <p className="text-gray-500 font-serif italic text-sm mb-8 leading-relaxed max-w-2xl mx-auto">
                    Our objective is a single AIC certification that satisfies all 16 SADC member state data protection authorities through Mutual Recognition Agreements (MRAs).
                </p>
                <button className="bg-[#0e1b2c] text-white px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-2xl">
                    Request a regional legal brief
                </button>
            </div>
        </div>
    );
}
