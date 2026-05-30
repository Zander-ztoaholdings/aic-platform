'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function POPIAFundamentalsPage() {
    const [step, setStep] = useState(0);

    const lessons = [
        {
            title: "The Spirit of Section 71",
            content: "Section 71 of POPIA is not just a technical rule; it is a safeguard for human dignity. It prohibits the use of automated systems to make final decisions that have legal or substantial consequences for a person, unless specific conditions are met.",
            highlight: "Meaningful Human Intervention is the golden thread."
        },
        {
            title: "The Three Thresholds",
            content: "For Section 71 to apply, the decision must: (1) result from automated processing, (2) have a legal effect, or (3) significantly affect the data subject.",
            highlight: "AIC Tiers map directly to these thresholds."
        },
        {
            title: "Data Subject Representations",
            content: "A data subject must be given a reasonable opportunity to make representations about an automated decision. This is why AIC mandates an 'Appeal Portal' for all Tier 1 and Tier 2 organizations.",
            highlight: "The right to be heard cannot be automated."
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
                        <h1 className="text-5xl font-serif font-bold text-aic-paper tracking-tight">{lessons[step].title}</h1>
                    </div>

                    <div className="bg-[#080808] border border-aic-paper/5 p-16 rounded-[3rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-aic-gold/30" />
                        <p className="text-xl text-gray-400 font-serif leading-relaxed italic mb-12">
                            "{lessons[step].content}"
                        </p>
                        <div className="bg-aic-paper/5 border border-aic-paper/10 p-8 rounded-2xl">
                            <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-widest mb-2">Lead Auditor Note</p>
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
