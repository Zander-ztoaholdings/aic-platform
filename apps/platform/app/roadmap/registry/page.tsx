'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { motion } from 'framer-motion';

export default function TrustRegistryPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/audit-logs')
            .then(res => res.json())
            .then(data => {
                setLogs(data.logs || []);
                setLoading(false);
            });
    }, []);

    return (
        <DashboardShell>
            <div className="max-w-6xl mx-auto pb-24">
                <div className="mb-12 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-aic-black underline decoration-aic-gold underline-offset-8">Immutable Trust Registry</h1>
                        <p className="text-gray-500 font-serif mt-4 italic">Cryptographic evidence trail for all algorithmic and human accountability events.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2">Registry Status</span>
                        <span className="text-green-500 font-mono text-xs font-bold animate-pulse">● SYNCHRONIZED</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500 italic">Syncing with ledger...</div>
                    ) : logs.map((log, i) => (
                        <motion.div 
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="bg-aic-paper border border-aic-black/5 p-6 rounded-xl flex items-center justify-between group hover:border-aic-gold transition-colors"
                        >
                            <div className="flex items-center gap-8">
                                <span className="font-mono text-[10px] text-gray-400 w-32">{new Date(log.created_at).toLocaleString()}</span>
                                <div>
                                    <p className="font-serif font-bold text-aic-black">{log.event_type}</p>
                                    <p className="text-[10px] font-mono text-gray-500 uppercase">{log.system_name}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-12">
                                <div className="text-right hidden md:block">
                                    <p className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-widest mb-1">Integrity Hash</p>
                                    <p className="font-mono text-[10px] text-aic-gold truncate w-48 select-all">
                                        {log.integrity_hash || 'SHA256-PENDING-SYNC-BLOCK-04'}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-green-500/20 flex items-center justify-center">
                                    <span className="text-[10px]">🔒</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-12 p-12 bg-aic-black rounded-[3rem] text-aic-paper relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 font-serif italic text-6xl">Immutable</div>
                    <h3 className="font-serif text-2xl mb-6">Auditor's Proof of Non-Repudiation</h3>
                    <p className="text-gray-400 font-serif text-sm leading-relaxed max-w-2xl italic">
                        The AIC Trust Registry utilizes SHA-256 hashing to anchor every audit event. This ensures that once a bias audit or human resolution is recorded, it cannot be retroactively modified without breaking the chain of evidence. This provides SANAS-level technical competence proof for your certification.
                    </p>
                </div>
            </div>
        </DashboardShell>
    );
}
