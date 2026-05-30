'use client';

import React from 'react';

export const InstitutionalFooter = () => {
    return (
        <footer className="bg-[#050505] text-aic-paper py-24 border-t border-aic-paper/5 font-mono uppercase tracking-[0.2em] text-[9px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none select-none">
                <div className="text-[15vw] font-bold leading-none">AIC</div>
            </div>
            
            <div className="max-w-7xl mx-auto px-12 grid grid-cols-1 md:grid-cols-4 gap-16 relative z-10">
                <div className="space-y-8">
                    <div className="text-xl font-serif font-bold tracking-tighter text-aic-paper">AIC<span className="text-aic-gold">.</span></div>
                    <p className="text-gray-500 leading-relaxed max-w-xs">
                        The definitive accountability layer for global automated systems. ISO/IEC 42001 & NIST AI RMF.
                    </p>
                </div>

                <div className="space-y-6">
                    <h4 className="text-aic-gold font-bold">Institutional</h4>
                    <nav className="flex flex-col gap-4 text-gray-400">
                        <a href="/about" className="hover:text-aic-paper transition-colors">Founder's Vision</a>
                        <a href="/rights" className="hover:text-aic-paper transition-colors">The Declaration of Algorithmic Rights</a>
                        <a href="/business/pricing" className="hover:text-aic-paper transition-colors">Institutional Pricing</a>
                        <a href="/governance" className="hover:text-aic-paper transition-colors">Regulatory Stack</a>
                        <a href="/registry" className="hover:text-aic-paper transition-colors">Certified Registry</a>
                    </nav>
                </div>

                <div className="space-y-6">
                    <h4 className="text-aic-gold font-bold">Technical</h4>
                    <nav className="flex flex-col gap-4 text-gray-400">
                        <a href="/engine" className="hover:text-aic-paper transition-colors">Audit Engine</a>
                        <a href="/documentation" className="hover:text-aic-paper transition-colors">API References</a>
                        <a href="/security" className="hover:text-aic-paper transition-colors">Data Sovereignty</a>
                    </nav>
                </div>

                <div className="space-y-6 text-right">
                    <h4 className="text-aic-gold font-bold text-right">Jurisdiction</h4>
                    <p className="text-gray-500">Global Operations<br />Distributed Registry</p>
                    <div className="pt-8">
                        <p className="text-aic-paper font-bold tracking-widest">© 2026 AI INTEGRITY</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};
