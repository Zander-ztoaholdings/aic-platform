'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { Trophy, Globe, TrendingUp, UserCheck, ShieldCheck } from 'lucide-react';

export default function GlobalLeaderboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(d => {
        setData(data || d); // Use mock if API fails
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Global Avg Integrity', value: data?.globalMetrics?.avgIntegrity + '%' || '84%', icon: TrendingUp },
    { label: 'Verified Human Overrides', value: data?.globalMetrics?.humanInterventionRate || '12.4%', icon: UserCheck },
    { label: 'Total Verified Audits', value: data?.globalMetrics?.totalVerifiedAudits || '1,242', icon: ShieldCheck },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-aic-black/5 pb-8 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-3 text-[#8a6a1f] mb-4 text-[12px] font-bold first-cap">
              <Globe className="w-4 h-4" />
              Global AI Integrity Index
            </div>
            <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-bold text-[#0e1b2c] tracking-tighter">
              Governance Leaderboard.
            </h1>
            <p className="text-xl text-gray-500 font-serif leading-relaxed italic mt-4 max-w-2xl">
              Transparent benchmarking of algorithmic accountability. Ranking the world&apos;s most empathetic AI systems.
            </p>
          </div>
        </header>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-aic-paper p-5 md:p-8 rounded-[2.5rem] border border-aic-black/5 shadow-xl flex flex-col items-center text-center"
            >
              <div className="p-4 bg-[#f5f7f9] rounded-2xl mb-6">
                <s.icon className="w-6 h-6 text-[#8a6a1f]" />
              </div>
              <p className="text-[12px] font-bold text-gray-500 first-cap mb-2">{s.label}</p>
              <p className="text-3xl md:text-4xl font-serif font-bold">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Rankings Table */}
        <section className="bg-white text-[#0e1b2c] p-6 md:p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 font-serif italic text-4xl md:text-6xl select-none pointer-events-none first-cap">Rankings</div>
          <div className="flex items-center gap-4 mb-12 relative z-10">
            <Trophy className="w-6 h-6 text-[#8a6a1f]" />
            <h3 className="font-serif text-2xl font-bold">Institutional Standings</h3>
          </div>

          <div className="space-y-4 relative z-10">
            {(data?.leaderboard || [
              { name: 'Example Bank Ltd', score: 98, tier: 'TIER_1' },
              { name: 'Example Healthcare Group', score: 95, tier: 'TIER_1' },
              { name: 'Example Investment Group', score: 92, tier: 'TIER_1' },
              { name: 'Example Public Sector Entity', score: 89, tier: 'TIER_2' },
              { name: 'AIC Internal', score: 84, tier: 'TIER_2' },
            ]).map((org: any, i: number) => (
              <motion.div 
                key={org.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (i * 0.05) }}
                className="flex items-center justify-between p-4 sm:p-6 bg-[#f5f7f9] border border-[#dde2e8] rounded-2xl hover:border-aic-gold/30 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <span className="font-mono text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                  <div>
                    <span className="font-serif text-xl block group-hover:text-[#8a6a1f] transition-colors">{org.name}</span>
                    <span className="text-[12px] text-gray-500 first-cap">{org.tier} Certified</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-serif font-bold text-[#8a6a1f]">{org.score}</span>
                  <span className="text-[12px] text-gray-500 block first-cap">Integrity Score</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
