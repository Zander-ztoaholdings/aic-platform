'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function BiasMethodologyModule() {
    const [step, setStep] = useState(0);

    const lessons = [
        {
            title: "Quantitative Foundations",
            content: "The Four-Fifths Rule (EEOC) remains the global standard for detecting adverse impact. As an AIC Auditor, you must verify that the selection rate for any group is at least 80% of the highest selection rate.",
            code: "impact_ratio = min_rate / max_rate"
        },
        {
            title: "Intersectional Subgroup Bounds",
            content: "Modern bias hiding occurs in the intersections. You will learn to use the Intersectional Analysis module to detect probability bounds across combined protected attributes (e.g., race + gender).",
            code: "analyze_intersectional(data, ['race', 'gender'], 'outcome')"
        },
        {
            title: "Immutable Hashing of Proof",
            content: "Audit integrity is absolute. Every technical result you generate must be cryptographically hashed and chained to ensure that evidence remains untampered throughout the certification lifecycle.",
            code: "h_i = Hash(h_{i-1} || Entry_i)"
        }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-center mb-12">
                <Link href="/training" className="text-[10px] font-mono font-bold text-gray-500 hover:text-aic-paper transition-colors uppercase tracking-widest">
                    ← Back to Training Hub
                </Link>
                <div className="flex gap-2">
                    {lessons.map((_, i) => (
                        <div key={i} className={`h-1 w-16 rounded-full transition-all duration-500 ${i === step ? 'bg-aic-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'bg-aic-paper/5'}`} />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div 
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-12"
                >
                    <div className="space-y-6">
                        <span className="text-aic-gold font-mono text-[10px] font-bold uppercase tracking-[0.4em]">Domain 02: Technical Audit</span>
                        <h1 className="text-5xl font-serif font-bold text-aic-paper tracking-tight">{lessons[step].title}</h1>
                    </div>

                    <div className="bg-[#080808] border border-aic-paper/5 p-16 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-aic-gold/20" />
                        <p className="text-xl text-gray-400 font-serif leading-relaxed italic mb-12 italic">
                            "{lessons[step].content}"
                        </p>
                        
                        <div className="bg-black border border-aic-paper/5 p-8 rounded-2xl font-mono text-[10px] text-aic-gold/80 flex items-center justify-between">
                            <span>{lessons[step].code}</span>
                            <span className="text-[8px] text-gray-600 uppercase">Audit_Logic_v3.1</span>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            <div className="flex justify-between pt-12 border-t border-aic-paper/5">
                <button 
                    onClick={() => setStep(Math.max(0, step - 1))}
                    disabled={step === 0}
                    className="px-10 py-4 font-mono text-[10px] font-bold text-gray-500 hover:text-aic-paper transition-all disabled:opacity-0"
                >
                    PREVIOUS_MODULE
                </button>
                <button 
                    onClick={() => step < lessons.length - 1 ? setStep(step + 1) : null}
                    className="bg-aic-paper text-black px-12 py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all shadow-xl"
                >
                    {step === lessons.length - 1 ? 'DOMAIN_COMPLETE' : 'NEXT_MODULE'}
                </button>
            </div>
        </div>
    );
}
