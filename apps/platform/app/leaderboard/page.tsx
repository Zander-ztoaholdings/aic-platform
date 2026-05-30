'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { Trophy, Globe, TrendingUp, UserCheck, ShieldCheck, Loader2, Zap, BarChart3 } from 'lucide-react';

export default function GlobalLeaderboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-aic-cyan" />
        <p className="italic text-aic-slate font-serif">Aggregating global accountability metrics...</p>
      </div>
    </DashboardShell>
  );

  const stats = [
    { label: 'Global Avg Integrity', value: data?.globalMetrics?.avgIntegrity + '%' || '84%', icon: TrendingUp },
    { label: 'Verified Human Overrides', value: data?.globalMetrics?.humanInterventionRate || '12.4%', icon: UserCheck },
    { label: 'Total Verified Audits', value: data?.globalMetrics?.totalVerifiedAudits || '1,242', icon: ShieldCheck },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-aic-paper/5 pb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-aic-cyan font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
              <Globe className="w-4 h-4" />
              Global AI Integrity Index
            </div>
            <h1 className="text-6xl font-serif font-bold text-aic-paper tracking-tighter leading-none">
              Accountability Leaders<span className="text-aic-cyan">.</span>
            </h1>
            <p className="text-xl text-aic-slate font-serif leading-relaxed italic max-w-2xl">
              Transparent benchmarking of algorithmic maturity. Ranking organizations by their verified commitment to the Five Algorithmic Rights.
            </p>
          </div>
        </header>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-aic-paper/[0.02] p-10 rounded-[3rem] border border-aic-paper/5 shadow-2xl relative overflow-hidden group hover:border-aic-cyan/30 transition-all"
            >
              <div className="p-4 bg-aic-cyan/5 rounded-2xl mb-8 w-fit group-hover:bg-aic-cyan/10 transition-colors">
                <s.icon className="w-6 h-6 text-aic-cyan" />
              </div>
              <p className="text-[10px] font-mono font-bold text-aic-slate uppercase tracking-widest mb-3">{s.label}</p>
              <p className="text-5xl font-serif font-bold text-aic-paper tracking-tighter">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Rankings Table */}
        <section className="bg-aic-paper/[0.01] border border-aic-paper/5 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] font-serif italic text-9xl select-none pointer-events-none uppercase tracking-tighter">Maturity</div>
          
          <div className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-4">
              <Trophy className="w-8 h-8 text-aic-gold" />
              <h3 className="font-serif text-3xl font-bold text-aic-paper">Institutional Standings</h3>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-aic-cyan/5 border border-aic-cyan/20 rounded-full text-[10px] font-mono font-bold text-aic-cyan uppercase">
              <Zap className="w-3 h-3 fill-aic-cyan" /> Live Telemetry Active
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {(data?.leaderboard || []).map((org: any, i: number) => (
              <motion.div 
                key={org.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (i * 0.05) }}
                className="flex items-center justify-between p-8 bg-aic-paper/[0.02] border border-aic-paper/5 rounded-3xl hover:bg-aic-paper/[0.04] hover:border-aic-cyan/20 transition-all group"
              >
                <div className="flex items-center gap-8">
                  <span className="font-mono text-lg font-bold text-aic-slate w-8">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <span className="font-serif text-2xl block text-aic-paper group-hover:text-aic-cyan transition-colors">{org.name}</span>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] font-mono text-aic-slate uppercase tracking-widest bg-aic-paper/5 px-2 py-0.5 rounded">{org.tier}</span>
                      <span className="text-[9px] font-mono text-green-500 uppercase tracking-widest">{org.formalAudits} Formal Audits</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-12 text-right">
                  <div>
                    <span className="text-3xl font-serif font-bold text-aic-paper group-hover:text-aic-cyan transition-colors">{org.maturityScore}</span>
                    <span className="text-[8px] font-mono text-aic-slate block uppercase tracking-widest mt-1">Maturity Score</span>
                  </div>
                  <div className="hidden md:block">
                    <BarChart3 className="w-8 h-8 text-aic-slate opacity-20" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
