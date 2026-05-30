'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CertificateProps {
    candidateName: string;
    completionDate: string;
    certificateId: string;
}

export const LeadAuditorCertificate = ({ candidateName, completionDate, certificateId }: CertificateProps) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl aspect-[1.414/1] bg-aic-paper border-[12px] border-aic-black p-12 relative overflow-hidden shadow-2xl"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #FAF9F6 0%, #F9F8F4 100%)' }}
        >
            {/* Guilloche-style corner accents */}
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-aic-gold/30 m-4" />
            <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-aic-gold/30 m-4" />
            <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-aic-gold/30 m-4" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-aic-gold/30 m-4" />

            <div className="h-full flex flex-col items-center justify-between text-center relative z-10 border border-aic-gold/20 p-8">
                <div className="space-y-4">
                    <div className="w-16 h-16 bg-aic-black flex items-center justify-center rounded-xl mx-auto mb-6">
                        <span className="text-aic-gold font-serif font-bold text-2xl">A</span>
                    </div>
                    <h1 className="text-[10px] font-mono font-bold tracking-[0.5em] text-aic-gold uppercase mb-2">AI Integrity Certification</h1>
                    <h2 className="text-4xl font-serif font-bold text-aic-black tracking-tight uppercase underline decoration-aic-gold underline-offset-8">Certificate of Competence</h2>
                </div>

                <div className="space-y-6 py-12">
                    <p className="text-sm font-serif italic text-gray-500">This is to certify that</p>
                    <h3 className="text-5xl font-serif font-bold text-aic-black tracking-tighter">{candidateName}</h3>
                    <p className="text-sm font-serif italic text-gray-500 max-w-lg mx-auto leading-relaxed">
                        has successfully completed the AIC Institutional Board Examination and is hereby recognized as a
                    </p>
                    <div className="px-8 py-3 bg-aic-black text-aic-paper font-mono text-xs font-bold tracking-[0.3em] inline-block rounded-lg uppercase">
                        Certified AIC Lead Auditor
                    </div>
                </div>

                <div className="w-full flex justify-between items-end border-t border-aic-black/5 pt-12">
                    <div className="text-left space-y-2">
                        <p className="text-[8px] font-mono text-gray-400 uppercase tracking-widest">Authorized By</p>
                        <div className="h-px w-32 bg-aic-black mb-2" />
                        <p className="text-[10px] font-mono font-bold text-aic-black">REGISTRY_DIRECTOR</p>
                    </div>

                    <div className="text-center">
                        <div className="w-20 h-20 border-2 border-aic-gold/20 rounded-full flex items-center justify-center opacity-50 mb-2">
                            <span className="text-[8px] font-mono text-aic-gold font-bold">AIC SEAL</span>
                        </div>
                        <p className="text-[7px] font-mono text-gray-400 uppercase tracking-tighter">Verified: {completionDate}</p>
                    </div>

                    <div className="text-right space-y-2">
                        <p className="text-[8px] font-mono text-gray-400 uppercase tracking-widest">Certificate ID</p>
                        <p className="text-[10px] font-mono font-bold text-aic-black">{certificateId}</p>
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 ml-auto animate-pulse" title="Blockchain Verified" />
                    </div>
                </div>
            </div>

            {/* Background Texture Overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/natural-paper.png")' }} />
        </motion.div>
    );
};
