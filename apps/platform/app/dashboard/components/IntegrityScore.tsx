'use client';

import { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';

interface ScoreComponent {
  label: string;
  weight: number;
  score: number;
}

interface IntegrityScoreProps {
  overall: number;
  trend: string;
  bottleneck: string;
  methodology: ScoreComponent[];
}

export function IntegrityScore({ overall, trend, bottleneck, methodology }: IntegrityScoreProps) {
  const [showMethod, setShowMethod] = useState(false);
  
  const col = overall >= 71 ? 'text-emerald-600' : overall >= 41 ? 'text-aic-gold' : 'text-red-600';
  const strokeCol = overall >= 71 ? '#059669' : overall >= 41 ? '#c36c32' : '#dc2626';
  const band = overall >= 71 ? 'Healthy' : overall >= 41 ? 'Attention' : 'Action Required';
  const bandVariant = overall >= 71 ? 'default' : overall >= 41 ? 'secondary' : 'destructive';

  const size = 110;
  const thick = 8;
  const r = size / 2 - thick - 2;
  const c = 2 * Math.PI * r;

  return (
    <Card className="p-6 bg-white border-gray-200 shadow-sm col-span-1 lg:col-span-2">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
        {/* Ring + score */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thick} />
            <circle 
              cx={size / 2} 
              cy={size / 2} 
              r={r} 
              fill="none" 
              stroke={strokeCol} 
              strokeWidth={thick}
              strokeDasharray={`${c * (overall / 100)} ${c}`} 
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-mono text-3xl font-bold ${col} leading-none`}>{overall}</span>
            <span className="font-mono text-[10px] text-gray-400">/ 100</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-serif text-2xl font-bold text-aic-navy">Integrity Score</h2>
            <Badge variant={bandVariant} className={overall >= 41 && overall < 71 ? 'bg-aic-gold/10 text-aic-gold hover:bg-aic-gold/20 border-none' : ''}>
              {band}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-gray-300 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p>The Integrity Score (0–100) is AIC&apos;s continuous measure of your organisation&apos;s AI accountability health. It is calculated from five weighted components. A score of 60+ is required for certification.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-2xl">{bottleneck}</p>
          
          <div className="flex flex-wrap items-center gap-6">
            <div className="font-mono text-xs text-gray-400">
              Trend: <strong className={overall >= 71 ? 'text-emerald-600' : 'text-aic-gold'}>{trend}</strong>
            </div>
            <button 
              onClick={() => setShowMethod(!showMethod)}
              className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-wider flex items-center gap-1.5 hover:text-aic-gold-light transition-colors"
            >
              Score methodology 
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showMethod ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showMethod && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {methodology.map((m) => {
                const mc = m.score >= 71 ? 'text-emerald-600' : m.score >= 41 ? 'text-aic-gold' : 'text-red-600';
                const mbc = m.score >= 71 ? 'bg-emerald-500' : m.score >= 41 ? 'bg-aic-gold' : 'bg-red-600';
                return (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-2 truncate">{m.label}</div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">Weight {m.weight}%</span>
                      <span className={`font-mono text-sm font-bold ${mc}`}>{m.score}</span>
                    </div>
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${mbc} transition-all duration-1000`} 
                        style={{ width: `${m.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex flex-col gap-2 w-full md:w-auto flex-shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
          <Button className="bg-aic-gold hover:bg-aic-gold-light text-white font-mono text-[11px] uppercase tracking-widest px-6 h-11 rounded-full">
            Submit Evidence
          </Button>
          <div className="font-mono text-[9px] text-gray-400 text-center uppercase tracking-widest">
            14 days to deadline
          </div>
        </div>
      </div>
    </Card>
  );
}
