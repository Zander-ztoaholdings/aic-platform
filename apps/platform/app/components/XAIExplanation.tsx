'use client';

import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface XAIExplanationProps {
    explanation: {
        feature_importance: Record<string, number>;
        base_value: number;
        method: string;
    };
}

export default function XAIExplanation({ explanation }: XAIExplanationProps) {
    const data = Object.entries(explanation.feature_importance)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 10);

    return (
        <div className="bg-aic-paper border border-aic-black/5 p-10 rounded-[2.5rem] shadow-xl">
            <div className="flex justify-between items-start mb-12">
                <div>
                    <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-4">Explainability Engine</h3>
                    <p className="font-serif text-xl text-aic-black font-bold tracking-tight">Factor Attribution Analysis</p>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest block mb-1">Methodology</span>
                    <span className="px-3 py-1 bg-aic-black text-aic-paper font-mono text-[9px] font-bold rounded-full uppercase">{explanation.method}</span>
                </div>
            </div>

            <div className="h-[400px] w-full mb-12">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontFamily: 'serif', fill: '#666' }} 
                            width={100}
                        />
                        <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const val = payload[0].value as number;
                                    return (
                                        <div className="bg-aic-black text-aic-paper p-4 rounded-xl shadow-2xl font-mono text-[10px]">
                                            <p className="uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                                            <p className={val > 0 ? 'text-green-400' : 'text-aic-red'}>
                                                IMPACT: {val > 0 ? '+' : ''}{val.toFixed(4)}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.value > 0 ? '#2c5f2d' : '#c41e3a'} 
                                    fillOpacity={0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="p-8 bg-aic-paper/50 border border-aic-black/5 rounded-2xl">
                <p className="text-xs font-serif text-gray-500 italic leading-relaxed">
                    <span className="text-aic-black font-bold not-italic mr-2 italic">Interpretation:</span>
                    Features in <span className="text-green-700 font-bold not-italic">Green</span> increased the probability of a positive outcome, while features in <span className="text-aic-red font-bold not-italic">Red</span> decreased it. The total impact is relative to the base value of {explanation.base_value.toFixed(4)}.
                </p>
            </div>
        </div>
    );
}
