'use client';

import React, { useState, useEffect } from 'react';
import DashboardShell from '../components/DashboardShell';
import { CPDProgressBar } from './components/CPDProgressBar';
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Lock, Award, CheckCircle2, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export default function PractitionerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/practitioner')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <DashboardShell>
      <div className="flex items-center justify-center h-[60vh] italic text-gray-500 font-serif">
        Syncing with global professional registry...
      </div>
    </DashboardShell>
  );

  const exams = data?.exams || [];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-aic-black/5 pb-8">
          <div>
            <div className="flex items-center gap-3 text-[#8a6a1f] mb-4 text-[12px] font-bold first-cap">
              <Award className="w-4 h-4" />
              Certified Practitioner Portal
            </div>
            <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-bold text-aic-black tracking-tighter">
              Professional Identity.
            </h1>
            <p className="text-xl text-gray-500 font-serif leading-relaxed italic mt-4 max-w-2xl">
              Credentialing for the world&apos;s most accountable AI practitioners. ISO 17024 compliant professional development and exam repository.
            </p>
          </div>
          <div className="bg-white text-[#0e1b2c] p-4 sm:p-6 rounded-[2rem] shadow-xl text-center min-w-[200px]">
            <span className="text-[12px] font-bold text-[#8a6a1f] first-cap block mb-2 text-center">Status</span>
            <div className="text-2xl font-serif font-bold">{data?.identity?.level || 'CANDIDATE'}</div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* CPD Column */}
          <div className="lg:col-span-2 space-y-8">
            <CPDProgressBar 
              progress={data?.cpd?.progress || 0} 
              label={data?.cpd?.label || "Annual Certification Cycle"} 
              sublabel={`Period: ${data?.cpd?.cycle || '2026'}`}
            />

            <div className="space-y-6">
              <h3 className="text-[12px] font-bold text-gray-500 first-cap">Knowledge Repository (Item Bank)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map((exam: any) => (
                  <motion.div 
                    key={exam.id}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "p-4 sm:p-6 rounded-[2rem] border transition-all",
                      exam.status === 'COMPLETED' ? "bg-[#f5f7f9] border-aic-green/20" : "bg-aic-paper border-aic-black/5 shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "p-3 rounded-xl",
                        exam.status === 'LOCKED' ? "bg-gray-100 text-gray-500" : "bg-white text-[#0e1b2c]"
                      )}>
                        {exam.status === 'LOCKED' ? <Lock className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      </div>
                      {exam.status === 'COMPLETED' && (
                        <span className="px-2 py-1 bg-aic-green/10 text-aic-green text-[12px] font-bold rounded first-cap">Verified</span>
                      )}
                    </div>
                    <h4 className="font-serif text-lg font-bold mb-1">{exam.name}</h4>
                    <p className="text-[12px] text-gray-500 first-cap">
                      {exam.status === 'LOCKED' ? `Prerequisite: ${exam.requirement}` : exam.status === 'COMPLETED' ? `Earned: ${exam.date}` : 'Examination Ready'}
                    </p>
                    
                    {exam.status === 'AVAILABLE' && (
                      <button className="mt-6 flex items-center gap-2 text-[12px] font-bold text-[#8a6a1f] hover:text-aic-black transition-colors first-cap">
                        Enter Exam Gateway <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Sidebar */}
          <div className="space-y-8">
            <div className="bg-white text-[#0e1b2c] p-6 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 font-serif italic text-4xl md:text-6xl select-none first-cap pointer-events-none">Shield</div>
              <h3 className="text-[12px] font-bold text-[#8a6a1f] first-cap mb-8 relative z-10">Institutional Shield</h3>
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-[#8a6a1f]" />
                  <span className="text-xs font-serif italic text-gray-700">ISO 17024 Accredited Exam Proctoring</span>
                </div>
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-[#8a6a1f]" />
                  <span className="text-xs font-serif italic text-gray-700">Biometric Identity Verification</span>
                </div>
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-[#8a6a1f]" />
                  <span className="text-xs font-serif italic text-gray-700">Encrypted Item Bank Protection</span>
                </div>
              </div>
              <button className="w-full mt-12 py-4 bg-[#f5f7f9] hover:bg-[#eef1f5] border border-[#dde2e8] rounded-2xl text-[12px] font-bold first-cap transition-all">
                Download Practitioner License
              </button>
            </div>

            <div className="p-5 md:p-8 bg-[#f5f7f9] border border-dashed border-aic-black/10 rounded-[2.5rem] text-center">
              <GraduationCap className="w-8 h-8 text-gray-500 mx-auto mb-4" />
              <p className="text-xs text-gray-500 font-serif italic">
                CPD analytics are synced with the Global Professional Registry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
