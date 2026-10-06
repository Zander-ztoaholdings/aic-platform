'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

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
            <div className="max-w-6xl pb-24">
                <div className="mb-8">
                    <Eyebrow>Compliance tracking</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Incidents and appeals</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">Appeals from people affected by an automated decision, and AI incidents your team has reported. Each one needs a person to review it.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-12">
                    {/* List View */}
                    <div className="lg:col-span-2 space-y-6">
                        {loading ? (
                            <div className="p-6 text-sm text-[#5e6b7b]">Loading…</div>
                        ) : incidents.length === 0 ? (
                            <div className="p-6 md:p-8 border border-[#dde2e8] bg-white rounded-xl">
                                <p className="text-sm text-[#5e6b7b]">No open appeals or incidents.</p>
                            </div>
                        ) : incidents.map((inc) => (
                            <motion.div 
                                key={inc.id}
                                layoutId={inc.id}
                                onClick={() => setSelectedIncident(inc)}
                                className={`p-5 md:p-8 bg-aic-paper border rounded-[2rem] cursor-pointer transition-all hover:shadow-xl ${
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
                                        <span className="text-[12px] font-bold text-gray-400 first-cap">{inc.status}</span>
                                    </div>
                                    <span className="text-[11.5px] text-gray-400">{new Date(inc.created_at).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-xl font-serif font-bold text-aic-black mb-2">{inc.citizen_email}</h3>
                                <p className="text-sm text-[#5e6b7b] truncate mb-4">"{inc.description}"</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-aic-gold first-cap">{inc.system_name}</span>
                                    <span className="text-[12px] text-gray-500">See details</span>
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
                                    className="bg-aic-black text-aic-paper p-6 md:p-12 rounded-xl h-fit border border-aic-paper/5"
                                >
                                    <h3 className="text-[12px] font-bold text-aic-gold first-cap mb-8">Incident Detail</h3>
                                    <div className="space-y-6 mb-12">
                                        <div>
                                            <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">Citizen</p>
                                            <p className="font-serif text-lg">{selectedIncident.citizen_email}</p>
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">Description</p>
                                            <p className="font-serif text-sm text-gray-400 leading-relaxed italic">"{selectedIncident.description}"</p>
                                        </div>
                                    </div>

                                    <h3 className="text-[12px] font-bold text-gray-500 first-cap mb-6">Human Review Findings</h3>
                                    <textarea 
                                        className="w-full bg-aic-paper/5 border border-aic-paper/10 rounded-2xl p-4 sm:p-6 font-serif text-sm text-aic-paper focus:border-aic-gold outline-none transition-all mb-6"
                                        rows={4}
                                        placeholder="Document your investigation and resolution..."
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                    />

                                    <div className="flex flex-col gap-4">
                                        {selectedIncident.status === 'OPEN' && (
                                            <button 
                                                onClick={() => handleResolve(selectedIncident.id, 'INVESTIGATING')}
                                                className="w-full bg-aic-gold text-black py-4 rounded-xl text-[12px] font-bold first-cap hover:bg-aic-paper transition-all"
                                            >
                                                Start investigating
                                            </button>
                                        )}
                                        
                                        {(selectedIncident.status === 'OPEN' || selectedIncident.status === 'INVESTIGATING') && (
                                            <>
                                                <button 
                                                    onClick={() => handleResolve(selectedIncident.id, 'RESOLVED')}
                                                    className="w-full bg-aic-paper text-black py-4 rounded-xl text-[12px] font-bold first-cap hover:bg-aic-gold transition-all"
                                                >
                                                    Mark as resolved
                                                </button>
                                                <button 
                                                    onClick={() => handleResolve(selectedIncident.id, 'DISMISSED')}
                                                    className="w-full border border-aic-paper/20 text-aic-paper py-4 rounded-xl text-[12px] font-bold first-cap hover:bg-aic-red transition-all"
                                                >
                                                    Dismiss the appeal
                                                </button>
                                            </>
                                        )}

                                        {selectedIncident.status === 'RESOLVED' && (
                                            <button 
                                                onClick={() => handleResolve(selectedIncident.id, 'CLOSED')}
                                                className="w-full bg-gray-800 text-aic-paper py-4 rounded-xl text-[12px] font-bold first-cap hover:bg-gray-700 transition-all"
                                            >
                                                ARCHIVE & CLOSE
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="p-6 md:p-8 border border-dashed border-[#dde2e8] rounded-xl">
                                    <p className="text-sm text-[#5e6b7b]">Choose an item on the left to review it.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}