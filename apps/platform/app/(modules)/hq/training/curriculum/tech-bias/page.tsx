'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function BiasAuditCurriculumPage() {
    const [step, setStep] = useState(0);

    const lessons = [
        {
            title: "The Four-Fifths Rule (EEOC)",
            content: "The fundamental metric for legal compliance. A selection rate for any group which is less than four-fifths (80%) of the rate for the group with the highest rate will generally be regarded as evidence of adverse impact.",
            highlight: "Formula: (Group B Selection Rate) / (Group A Selection Rate) < 0.8"
        },
        {
            title: "Statistical Significance (Chi-Square)",
            content: "Disparity alone is not proof of bias. Auditors must verify that the difference is statistically significant and not due to random chance, especially in small sample sizes.",
            highlight: "AIC Engine uses p-value < 0.05 as the threshold for 'Significant Bias'."
        },
        {
            title: "Proxy Detection & Red-Teaming",
            content: "Modern models often hide bias in 'proxies' (e.g., using Postal Code to infer Race). Lead Auditors must identify these hidden correlations through feature importance and red-team stress testing.",
            highlight: "The Audit Engine scans for >0.7 correlation with protected attributes."
        }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex justify-between items-center mb-12">
                <Link href="/training" className="text-[10px] font-mono font-bold text-gray-500 hover:text-aic-paper transition-colors uppercase tracking-widest">
                    ← Back to Academy
                </Link>
                <div className="flex gap-2">
                    {lessons.map((_, i) => (
                        <div key={i} className={`h-1 w-12 rounded-full transition-all ${i === step ? 'bg-aic-gold' : 'bg-aic-paper/10'}`} />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div 
                    key={step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-12"
                >
                    <div className="space-y-6">
                        <span className="text-aic-gold font-mono text-[10px] font-bold uppercase tracking-[0.4em]">Lesson 0{step + 1} / 0{lessons.length}</span>
                        <h1 className="text-5xl font-serif font-bold text-aic-paper tracking-tight leading-none">{lessons[step].title}</h1>
                    </div>

                    <div className="bg-[#080808] border border-aic-paper/5 p-16 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/30" />
                        <p className="text-xl text-gray-400 font-serif leading-relaxed italic mb-12">
                            "{lessons[step].content}"
                        </p>
                        <div className="bg-aic-paper/5 border border-aic-paper/10 p-8 rounded-2xl">
                            <p className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-2">Technical Lead Note</p>
                            <p className="text-sm font-serif text-aic-paper font-medium">{lessons[step].highlight}</p>
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
                    PREVIOUS_LESSON
                </button>
                <button 
                    onClick={() => step < lessons.length - 1 ? setStep(step + 1) : null}
                    className="bg-aic-paper text-black px-12 py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all shadow-xl"
                >
                    {step === lessons.length - 1 ? 'MODULE_COMPLETE' : 'NEXT_LESSON'}
                </button>
            </div>
        </div>
    );
}
