'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { Trophy, Globe, TrendingUp, UserCheck, ShieldCheck, Loader2, BarChart3 } from 'lucide-react';

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
        <Loader2 className="w-10 h-10 animate-spin text-[#8a6a1f]" />
        <p className="text-sm text-[#5e6b7b]">Loading…</p>
      </div>
    </DashboardShell>
  );

  const stats = [
    { label: 'Global Avg Integrity', value: data?.globalMetrics?.avgIntegrity != null ? `${data.globalMetrics.avgIntegrity}%` : '—', icon: TrendingUp },
    { label: 'Verified Human Overrides', value: data?.globalMetrics?.humanInterventionRate ?? '—', icon: UserCheck },
    { label: 'Total Verified Audits', value: data?.globalMetrics?.totalVerifiedAudits ?? '—', icon: ShieldCheck },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-b border-[#dde2e8] pb-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-[#8a6a1f] text-[12px] font-bold first-cap">
              <Globe className="w-4 h-4" />
              Global AI Integrity Index
            </div>
            <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">
              Accountability Leaders<span className="text-[#8a6a1f]">.</span>
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
              Transparent benchmarking of algorithmic maturity. Ranking organizations by their verified commitment to the Five Algorithmic Rights.
            </p>
          </div>
        </header>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {stats.map((s, i) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#f5f7f9] p-6 md:p-10 rounded-xl border border-[#dde2e8] relative overflow-hidden group hover:border-aic-cyan/30 transition-all"
            >
              <div className="p-4 bg-aic-cyan/5 rounded-2xl mb-8 w-fit group-hover:bg-aic-cyan/10 transition-colors">
                <s.icon className="w-6 h-6 text-[#8a6a1f]" />
              </div>
              <p className="text-[12px] font-bold text-aic-slate first-cap mb-3">{s.label}</p>
              <p className="text-[2rem] leading-tight md:text-5xl font-serif font-bold text-[#0e1b2c]">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Rankings Table */}
        <section className="bg-[#f5f7f9] border border-[#dde2e8] p-6 md:p-12 rounded-[3.5rem] relative overflow-hidden">
          
          <div className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-4">
              <Trophy className="w-8 h-8 text-[#8a6a1f]" />
              <h3 className="font-serif text-3xl font-bold text-[#0e1b2c]">Institutional Standings</h3>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {data && !data.leaderboard?.length && (
              <p className="text-sm text-[#5e6b7b]">No organisation has agreed to appear on the index yet.</p>
            )}
            {(data?.leaderboard || []).map((org: any, i: number) => (
              <motion.div 
                key={org.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (i * 0.05) }}
                className="flex items-center justify-between p-5 md:p-8 bg-[#f5f7f9] border border-[#dde2e8] rounded-xl hover:bg-[#eef1f5] hover:border-aic-cyan/20 transition-all group"
              >
                <div className="flex items-center gap-8">
                  <span className="font-mono text-lg font-bold text-aic-slate w-8">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <span className="font-serif text-2xl block text-[#0e1b2c] group-hover:text-[#8a6a1f] transition-colors">{org.name}</span>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[12px] text-aic-slate first-cap bg-[#f5f7f9] px-2 py-0.5 rounded">{org.tier}</span>
                      <span className="text-[12px] text-green-700 first-cap">{org.formalAudits} Formal Audits</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-12 text-right">
                  <div>
                    <span className="text-3xl font-serif font-bold text-[#0e1b2c] group-hover:text-[#8a6a1f] transition-colors">{org.maturityScore}</span>
                    <span className="text-[12px] text-aic-slate block first-cap mt-1">Maturity Score</span>
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
