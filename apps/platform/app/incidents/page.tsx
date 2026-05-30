'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const [resolution, setResolution] = useState('');

    const fetchIncidents = () => {
        fetch('/api/incidents')
            .then(res => res.json())
            .then(data => {
                setIncidents(data.incidents || []);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchIncidents();
    }, []);

    const handleResolve = async (id: string, status: 'RESOLVED' | 'DISMISSED' | 'INVESTIGATING' | 'CLOSED') => {
        try {
            const res = await fetch(`/api/incidents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, resolution_details: resolution })
            });
            if (res.ok) {
                if (status === 'RESOLVED' || status === 'DISMISSED' || status === 'CLOSED') {
                    setSelectedIncident(null);
                    setResolution('');
                } else {
                    // Just update the selected incident state if still investigating
                    const data = await res.json();
                    setSelectedIncident(data.incident);
                }
                toast.success(`Institutional appeal updated to ${status.toLowerCase()}.`);
                fetchIncidents();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update incident');
            }
        } catch {
            toast.error('Connection failure while resolving incident.');
        }
    };

    return (
        <DashboardShell>
            <div className="max-w-6xl mx-auto pb-24">
                <div className="mb-12">
                    <h1 className="text-3xl font-serif font-bold text-aic-black underline decoration-aic-gold underline-offset-8">Human Accountability Queue</h1>
                    <p className="text-gray-500 font-serif mt-4 italic">Resolve citizen appeals and maintain POPIA Section 71 compliance.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* List View */}
                    <div className="lg:col-span-2 space-y-6">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500 italic">Syncing with appeal registry...</div>
                        ) : incidents.length === 0 ? (
                            <div className="p-12 border border-dashed border-aic-black/10 rounded-[2rem] text-center">
                                <p className="text-gray-400 font-serif italic">No open appeals found. Your systems are maintaining human dignity.</p>
                            </div>
                        ) : incidents.map((inc) => (
                            <motion.div 
                                key={inc.id}
                                layoutId={inc.id}
                                onClick={() => setSelectedIncident(inc)}
                                className={`p-8 bg-aic-paper border rounded-[2rem] cursor-pointer transition-all hover:shadow-xl ${
                                    selectedIncident?.id === inc.id ? 'border-aic-gold shadow-lg' : 'border-aic-black/5'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${
                                            inc.status === 'OPEN' ? 'bg-aic-red animate-pulse' : 
                                            inc.status === 'INVESTIGATING' ? 'bg-aic-gold animate-pulse' :
                                            inc.status === 'CLOSED' ? 'bg-gray-400' : 'bg-green-500'
                                        }`} />
                                        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">{inc.status}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-400">{new Date(inc.created_at).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-xl font-serif font-bold text-aic-black mb-2">{inc.citizen_email}</h3>
                                <p className="text-sm font-serif text-gray-500 italic truncate mb-4">"{inc.description}"</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-widest">{inc.system_name}</span>
                                    <span className="text-[10px] font-mono text-gray-400">View Details →</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Detail/Resolution View */}
                    <div className="sticky top-8">
                        <AnimatePresence mode="wait">
                            {selectedIncident ? (
                                <motion.div 
                                    key="detail"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="bg-aic-black text-aic-paper p-12 rounded-[2.5rem] shadow-2xl h-fit border border-aic-paper/5"
                                >
                                    <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-8">Incident Detail</h3>
                                    <div className="space-y-6 mb-12">
                                        <div>
                                            <p className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Citizen</p>
                                            <p className="font-serif text-lg">{selectedIncident.citizen_email}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Description</p>
                                            <p className="font-serif text-sm text-gray-400 leading-relaxed italic">"{selectedIncident.description}"</p>
                                        </div>
                                    </div>

                                    <h3 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.4em] mb-6">Human Review Findings</h3>
                                    <textarea 
                                        className="w-full bg-aic-paper/5 border border-aic-paper/10 rounded-2xl p-6 font-serif text-sm text-aic-paper focus:border-aic-gold outline-none transition-all mb-6"
                                        rows={4}
                                        placeholder="Document your investigation and resolution..."
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                    />

                                    <div className="flex flex-col gap-4">
                                        {selectedIncident.status === 'OPEN' && (
                                            <button 
                                                onClick={() => handleResolve(selectedIncident.id, 'INVESTIGATING')}
                                                className="w-full bg-aic-gold text-black py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-paper transition-all"
                                            >
                                                START INVESTIGATION
                                            </button>
                                        )}
                                        
                                        {(selectedIncident.status === 'OPEN' || selectedIncident.status === 'INVESTIGATING') && (
                                            <>
                                                <button 
                                                    onClick={() => handleResolve(selectedIncident.id, 'RESOLVED')}
                                                    className="w-full bg-aic-paper text-black py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all"
                                                >
                                                    MARK AS RESOLVED
                                                </button>
                                                <button 
                                                    onClick={() => handleResolve(selectedIncident.id, 'DISMISSED')}
                                                    className="w-full border border-aic-paper/20 text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-red transition-all"
                                                >
                                                    DISMISS APPEAL
                                                </button>
                                            </>
                                        )}

                                        {selectedIncident.status === 'RESOLVED' && (
                                            <button 
                                                onClick={() => handleResolve(selectedIncident.id, 'CLOSED')}
                                                className="w-full bg-gray-800 text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-gray-700 transition-all"
                                            >
                                                ARCHIVE & CLOSE
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="p-12 border border-dashed border-aic-black/10 rounded-[2.5rem] text-center bg-aic-paper/30">
                                    <p className="text-gray-400 font-serif italic text-sm">Select an incident from the queue to perform human review.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}