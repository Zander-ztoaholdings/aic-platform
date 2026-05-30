'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { Info } from 'lucide-react';

interface PulseMonitorProps {
  decisionsToday: number;
  overrideRate: number;
  overrideHealthMin: number;
  overrideHealthMax: number;
  openFindings: number;
  findingsMaxSev: 'critical' | 'significant' | 'minor';
  daysToMilestone: number;
  milestoneLabel: string;
  sparkline: number[];
}

export function PulseMonitor({
  decisionsToday,
  overrideRate,
  overrideHealthMin,
  overrideHealthMax,
  openFindings,
  findingsMaxSev,
  daysToMilestone,
  milestoneLabel,
  sparkline
}: PulseMonitorProps) {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const orHealthy = overrideRate >= overrideHealthMin && overrideRate <= overrideHealthMax;
  const orCol = orHealthy ? 'text-emerald-600' : overrideRate < overrideHealthMin ? 'text-aic-gold' : 'text-red-600';
  const orBg = orHealthy ? 'bg-emerald-500' : overrideRate < overrideHealthMin ? 'bg-aic-gold' : 'bg-red-600';
  const orStatus = orHealthy ? 'Healthy' : overrideRate < overrideHealthMin ? 'Too low — review oversight' : 'Too high — investigate';
  const orPct = Math.min((overrideRate / (overrideHealthMax * 1.5)) * 100, 100);

  // Simple sparkline points
  const svgW = 120;
  const svgH = 30;
  const spMax = Math.max(...sparkline);
  const spMin = Math.min(...sparkline);
  const pts = sparkline.map((v, i) => {
    const x = (i / (sparkline.length - 1)) * svgW;
    const y = svgH - ((v - spMin) / (spMax - spMin || 1)) * (svgH * 0.8) - (svgH * 0.1);
    return `${x},${y}`;
  }).join(' ');

  return (
    <Card className="p-6 bg-white border-gray-200 shadow-sm col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-aic-gold" />
          <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Pulse Telemetry</span>
        </div>
        <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Updated {time.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Decisions today */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Decisions Today</div>
          <div className="font-mono text-2xl font-bold text-aic-navy leading-none mb-1">{decisionsToday.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400">Total processed across all systems</div>
        </div>

        {/* Override Rate */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex justify-between items-start mb-3">
            <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Override Rate</div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-gray-300" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">Healthy band: {overrideHealthMin}–{overrideHealthMax}%. Too low suggests rubber-stamping; too high suggests poorly-calibrated models.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={`font-mono text-2xl font-bold ${orCol} leading-none mb-2`}>{overrideRate.toFixed(1)}%</div>
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden relative mb-1.5">
             <div 
               className="absolute top-0 bottom-0 bg-emerald-600/10" 
               style={{ left: `${(overrideHealthMin / (overrideHealthMax * 1.5)) * 100}%`, width: `${((overrideHealthMax - overrideHealthMin) / (overrideHealthMax * 1.5)) * 100}%` }} 
             />
             <div 
               className={`absolute top-0 bottom-0 w-1 ${orBg} rounded-full`} 
               style={{ left: `calc(${orPct}% - 2px)` }}
             />
          </div>
          <div className={`text-[9px] font-bold uppercase tracking-wide ${orCol}`}>{orStatus}</div>
        </div>

        {/* Open Findings */}
        <div className={`rounded-xl p-4 border ${findingsMaxSev === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className={`font-mono text-[9px] font-bold uppercase tracking-widest mb-3 ${findingsMaxSev === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>Open Findings</div>
          <div className={`font-mono text-2xl font-bold leading-none mb-2 ${findingsMaxSev === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{openFindings}</div>
          <Badge variant={findingsMaxSev === 'critical' ? 'destructive' : 'secondary'} className="h-4 text-[8px] uppercase font-bold tracking-widest px-1.5">
            {findingsMaxSev}
          </Badge>
        </div>

        {/* Days to Deadline */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Days to Deadline</div>
          <div className={`font-mono text-2xl font-bold leading-none mb-1 ${daysToMilestone <= 7 ? 'text-red-600' : 'text-aic-navy'}`}>{daysToMilestone}</div>
          <div className="text-[10px] text-gray-400">{milestoneLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">7-Day Trend</div>
        <svg width={svgW} height={svgH} className="flex-shrink-0">
          <polyline
            fill="none"
            stroke="#c36c32"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pts}
          />
        </svg>
        <div className="flex-1 border-t border-dashed border-gray-200" />
        <div className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          {sparkline[sparkline.length - 1].toLocaleString()} decisions today
        </div>
      </div>
    </Card>
  );
}
