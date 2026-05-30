'use client';

import { Card } from '../../components/ui/card';

interface Right {
  id: number;
  name: string;
  score: number;
  trend: string;
  trendDir: 'up' | 'flat' | 'down';
  metric: string;
  status: 'healthy' | 'attention' | 'action';
}

interface RightsRibbonProps {
  rights: Right[];
}

export function RightsRibbon({ rights }: RightsRibbonProps) {
  const trendCol = { up: 'text-emerald-600', flat: 'text-gray-400', down: 'text-red-600' };
  
  return (
    <div className="col-span-1 lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-aic-gold" />
          <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Five Algorithmic Rights</span>
        </div>
        <button className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-widest hover:underline">
          View Details
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {rights.map((r) => {
          const col = r.score >= 71 ? 'text-emerald-600' : r.score >= 41 ? 'text-aic-gold' : 'text-red-600';
          const bgCol = r.score >= 71 ? 'bg-emerald-600' : r.score >= 41 ? 'bg-aic-gold' : 'bg-red-600';
          const statusCol = r.status === 'healthy' ? 'text-emerald-600' : r.status === 'attention' ? 'text-aic-gold' : 'text-red-600';
          const statusBg = r.status === 'healthy' ? 'bg-emerald-50' : r.status === 'attention' ? 'bg-aic-gold/10' : 'bg-red-50';
          
          return (
            <Card 
              key={r.id} 
              className="p-4 bg-white hover:shadow-md transition-shadow cursor-pointer border-gray-100 flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-widest">R{r.id}</span>
                <span className={`font-mono text-xs font-bold ${trendCol[r.trendDir]}`}>{r.trendDir === 'up' ? '↑' : r.trendDir === 'down' ? '↓' : '→'}</span>
              </div>
              
              <h3 className="font-serif text-sm font-bold text-aic-navy mb-1 line-clamp-1">{r.name}</h3>
              
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`font-mono text-xl font-bold ${col}`}>{r.score}</span>
                <span className="font-mono text-[9px] text-gray-400">/100</span>
              </div>
              
              <div className="h-0.5 w-full bg-gray-100 rounded-full mb-4 overflow-hidden mt-auto">
                <div 
                  className={`h-full ${bgCol} transition-all duration-1000`} 
                  style={{ width: `${r.score}%` }}
                />
              </div>
              
              <div className="text-[9px] text-gray-500 leading-tight mb-3 line-clamp-2 h-6">
                {r.metric}
              </div>
              
              <div className={`mt-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${statusBg} ${statusCol}`}>
                <div className={`w-1 h-1 rounded-full ${bgCol}`} />
                {r.status === 'healthy' ? 'Healthy' : r.status === 'attention' ? 'Attention' : 'Action'}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
