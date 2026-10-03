'use client';

import { useEffect, useState, Suspense } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

function AuditsContent() {
    const searchParams = useSearchParams();
    const q = searchParams.get('q');
    
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResults, setVerificationResults] = useState<Record<string, string>>({});
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    const fetchLogs = (page = 1) => {
        setLoading(true);
        let url = `/api/audit-logs?page=${page}&limit=25`;
        if (q) url += `&q=${encodeURIComponent(q)}`;
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setLogs(data.logs || []);
                setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchLogs(1);
    }, [q]);

    const handleVerifyChain = async () => {
        setIsVerifying(true);
        try {
            const res = await fetch('/api/audit-logs/verify', { method: 'POST' });
            const data = await res.json();
            
            const resultsMap: Record<string, string> = {};
            data.results.forEach((r: any) => {
                resultsMap[r.id] = r.status;
            });
            setVerificationResults(resultsMap);
            
            if (data.is_valid) {
                toast.success('Institutional immutability confirmed. All audit links are valid.');
            } else {
                toast.error('Integrity alert: Potential tampering detected in audit chain.');
            }
        } catch {
            toast.error('Failed to connect to verification engine.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleRunAudit = async () => {
        setIsRunning(true);
        try {
            // Correct format for API/v1/analyze
            const sampleData = {
                "protected_attribute": "race",
                "outcome_variable": "hired",
                "rows": [
                    {"race": "Group A", "hired": 1},
                    {"race": "Group A", "hired": 1},
                    {"race": "Group B", "hired": 1},
                    {"race": "Group B", "hired": 0}
                ]
            };

            const response = await fetch('/api/audit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemName: 'Production Loan Engine v2.4',
                    data: sampleData
                })
            });

            if (response.ok) {
                toast.success("Audit analysis complete. Cryptographic hash recorded.");
                fetchLogs();
            } else {
                const err = await response.json();
                toast.error(`Audit Failed: ${err.detail}`);
            }
        } catch {
            toast.error("Connection to Audit Engine failed.");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <DashboardShell>
            <div className="max-w-5xl mx-auto pb-24">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-aic-black underline decoration-aic-gold underline-offset-8">Technical Audit Logs</h1>
                        <p className="text-gray-500 font-serif mt-4">Immutable verification of your algorithmic outcomes via the AIC Engine.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-4">
                        <button 
                            onClick={handleVerifyChain}
                            disabled={isVerifying}
                            className="bg-[#0e1b2c] text-white border border-aic-black/10 px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:border-aic-black transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
                        >
                            {isVerifying ? (
                                <>
                                    <div className="h-3 w-3 border-2 border-aic-gold border-t-transparent rounded-full animate-spin" />
                                    VERIFYING...
                                </>
                            ) : 'Integrity check'}
                        </button>
                        <button 
                            onClick={handleRunAudit}
                            disabled={isRunning}
                            className="bg-white text-[#0e1b2c] px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-aic-gold hover:text-black transition-all shadow-xl disabled:opacity-50"
                        >
                            {isRunning ? 'Analysing…' : 'Run bias audit'}
                        </button>
                        <button 
                            onClick={async () => {
                                setIsRunning(true);
                                try {
                                    const sampleOddsData = {
                                        "protected_attribute": "gender",
                                        "actual_outcome": "repaid",
                                        "predicted_outcome": "pred_repaid",
                                        "rows": [
                                            {"gender": "M", "repaid": 1, "pred_repaid": 1},
                                            {"gender": "F", "repaid": 1, "pred_repaid": 0}
                                        ]
                                    };
                                    const res = await fetch('/api/audit-logs', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ systemName: 'Advanced Risk Model', data: sampleOddsData, type: 'EQUALIZED_ODDS' })
                                    });
                                    if (res.ok) { toast.success("Advanced Equalized Odds audit recorded."); fetchLogs(); }
                                } finally { setIsRunning(false); }
                            }}
                            disabled={isRunning}
                            className="border border-aic-black text-aic-black px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-aic-red hover:text-[#0e1b2c] transition-all disabled:opacity-50"
                        >
                            Run equalised-odds audit
                        </button>
                        <button 
                            onClick={async () => {
                                setIsRunning(true);
                                try {
                                    const samplePrivacyData = {
                                        "columns": ["user_id", "race", "biometric_data", "transaction_amount", "religious_affiliation"]
                                    };
                                    const res = await fetch('/api/audit-logs/privacy', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ systemName: 'Customer Data Lake', data: samplePrivacyData })
                                    });
                                    if (res.ok) { toast.success("Privacy Schema Audit complete. SPI risks identified."); fetchLogs(); }
                                } finally { setIsRunning(false); }
                            }}
                            disabled={isRunning}
                            className="border border-aic-black text-aic-black px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-aic-red hover:text-[#0e1b2c] transition-all disabled:opacity-50"
                        >
                            Run privacy audit
                        </button>
                        <button 
                            onClick={async () => {
                                setIsRunning(true);
                                try {
                                    const sampleLaborData = {
                                        "total_decisions": 1000,
                                        "human_interventions": 150,
                                        "human_overrides": 45
                                    };
                                    const res = await fetch('/api/audit-logs/labor', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ systemName: 'Automated Hiring Bot', data: sampleLaborData })
                                    });
                                    if (res.ok) { toast.success("Labor Agency audit complete. Automation density recorded."); fetchLogs(); }
                                } finally { setIsRunning(false); }
                            }}
                            disabled={isRunning}
                            className="border border-aic-black text-aic-black px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-green-600 hover:text-[#0e1b2c] transition-all disabled:opacity-50"
                        >
                            Run labour agency audit
                        </button>
                    </div>
                </div>

                <div className="bg-aic-paper border border-aic-black/5 rounded-3xl overflow-hidden shadow-sm">
                    {q && (
                        <div className="bg-aic-paper p-4 border-b border-aic-black/5 flex justify-between items-center">
                            <span className="text-[12px] text-gray-500 first-cap">Search Results for: <strong className="text-aic-black">{q}</strong></span>
                            <button onClick={() => window.location.href = '/audits'} className="text-[12px] font-bold text-aic-red first-cap underline">Clear Search</button>
                        </div>
                    )}
                    <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left text-sm font-serif">
                        <thead className="bg-[#f5f7f9] border-b border-aic-black/5">
                            <tr>
                                <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Timestamp</th>
                                <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">System / Version</th>
                                <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Audit Event</th>
                                <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Verification</th>
                                <th className="p-4 sm:p-6 text-right text-[12px] font-bold text-gray-500 first-cap">Integrity Hash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-aic-black/5">
                            {loading ? (
                                <tr><td colSpan={4} className="p-6 md:p-12 text-center text-gray-500 italic">Syncing with secure logs...</td></tr>
                            ) : logs.map((log, i) => (
                                <motion.tr 
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="hover:bg-[#eef1f5] transition-colors group"
                                >
                                    <td className="p-4 sm:p-6 text-gray-500 font-mono text-[11.5px]">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="p-4 sm:p-6 font-bold text-aic-black">{log.system_name}</td>
                                    <td className="p-4 sm:p-6 font-mono text-xs">{log.event_type}</td>
                                    <td className="p-4 sm:p-6">
                                        {verificationResults[log.id] ? (
                                            <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2 py-0.5 rounded first-cap ${
                                                verificationResults[log.id] === 'VERIFIED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                            }`}>
                                                {verificationResults[log.id] === 'VERIFIED' ? (
                                                    <><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> SECURE</>
                                                ) : (
                                                    <><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> TAMPERED</>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] font-mono text-gray-700 italic">Unverified</span>
                                        )}
                                    </td>
                                    <td className="p-4 sm:p-6 text-right">
                                        <span className="font-mono text-[11px] bg-gray-100 px-2 py-1 rounded text-gray-500 select-all group-hover:text-[#8a6a1f] transition-colors">
                                            {log.integrity_hash ? log.integrity_hash.substring(0, 16) : 'PENDING'}...
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                            {!loading && logs.length === 0 && (
                                <tr><td colSpan={4} className="p-6 md:p-12 text-center text-gray-500 italic font-serif">No technical audit logs found matching your query.</td></tr>
                            )}
                        </tbody>
                    </table></div>
                    
                    {pagination.pages > 1 && (
                        <div className="p-4 sm:p-6 border-t border-aic-black/5 bg-[#f5f7f9] flex justify-between items-center">
                            <p className="text-[12px] font-bold text-gray-500 first-cap">Page {pagination.page} of {pagination.pages} • {pagination.total} Records</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => fetchLogs(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="px-4 py-2 border border-aic-black/10 rounded-lg text-[12px] font-bold first-cap hover:bg-[#eef1f5] hover:text-[#0e1b2c] transition-all disabled:opacity-30"
                                >
                                    Previous
                                </button>
                                <button 
                                    onClick={() => fetchLogs(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.pages}
                                    className="px-4 py-2 border border-aic-black/10 rounded-lg text-[12px] font-bold first-cap hover:bg-[#eef1f5] hover:text-[#0e1b2c] transition-all disabled:opacity-30"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 p-5 md:p-8 bg-white rounded-3xl text-[#0e1b2c] flex items-center justify-between border border-[#dde2e8] shadow-2xl">
                    <div>
                        <h4 className="font-serif text-xl mb-2 italic text-[#8a6a1f]">Evidence Hardening</h4>
                        <p className="text-gray-500 text-sm font-serif">Every audit log is cryptographically hashed. This provides tamper-proof evidence for your Lead Auditor during certification review.</p>
                    </div>
                    <div className="w-16 h-16 rounded-full border border-aic-gold/30 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-aic-gold animate-ping" />
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}

export default function AuditsPage() {
    return (
        <Suspense fallback={<DashboardShell><div className="py-20 text-center italic font-serif text-gray-500">Loading audit infrastructure...</div></DashboardShell>}>
            <AuditsContent />
        </Suspense>
    );
}
