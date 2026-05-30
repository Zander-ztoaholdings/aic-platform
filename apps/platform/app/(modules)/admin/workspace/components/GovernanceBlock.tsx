'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, UserCheck, Trash2, Info, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export type BlockType = 'text' | 'header' | 'human-context' | 'model-card';

export interface GovernanceBlockData {
  id: string;
  type: BlockType;
  content: any;
  isMandatory?: boolean;
}

interface GovernanceBlockProps {
  block: GovernanceBlockData;
  onUpdate: (id: string, content: any) => void;
  onDelete: (id: string) => void;
  impactMagnitude: number;
}

export const GovernanceBlock = ({ block, onUpdate, onDelete, impactMagnitude }: GovernanceBlockProps) => {

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative p-6 bg-aic-paper rounded-3xl border border-aic-black/5 shadow-sm hover:shadow-md transition-all",
        block.isMandatory && "border-l-4 border-l-red-700 bg-red-50/30"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {block.type === 'human-context' && <UserCheck className="w-4 h-4 text-red-700" />}
          {block.type === 'model-card' && <Shield className="w-4 h-4 text-aic-gold" />}
          {block.type === 'text' && <Activity className="w-4 h-4 text-gray-400" />}
          <span className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest">
            {block.type.replace('-', ' ')} {block.isMandatory && "(MANDATORY)"}
          </span>
        </div>
        
        {!block.isMandatory && (
          <button 
            onClick={() => onDelete(block.id)}
            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-400 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {block.type === 'text' && (
        <textarea
          className="w-full bg-transparent border-none focus:ring-0 font-serif text-lg text-gray-700 resize-none min-h-[100px] outline-none"
          placeholder="Enter governance rationale..."
          value={block.content.text || ''}
          onChange={(e) => onUpdate(block.id, { ...block.content, text: e.target.value })}
        />
      )}

      {block.type === 'human-context' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-red-700/5 rounded-xl border border-red-700/10">
            <Info className="w-4 h-4 text-red-700" />
            <p className="text-[11px] text-red-800 font-medium">
              High Human Impact detected ({impactMagnitude}/10). Qualitative rationale required for ISO 42001 alignment.
            </p>
          </div>
          <textarea
            className="w-full bg-aic-paper/50 border border-red-200 rounded-2xl p-4 font-serif text-lg focus:border-red-700 outline-none transition-all"
            placeholder="Describe the human stakeholders affected and mitigation strategies..."
            value={block.content.rationale || ''}
            onChange={(e) => onUpdate(block.id, { ...block.content, rationale: e.target.value })}
          />
        </div>
      )}

      {block.type === 'model-card' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-aic-paper/30 p-6 rounded-2xl border border-dashed border-aic-black/10">
            <div className="space-y-4">
              <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Model Name</label>
              <input
                className="w-full bg-aic-paper border border-aic-black/5 rounded-xl p-3 text-sm focus:border-aic-gold outline-none transition-all"
                placeholder="e.g. CreditRisk-v4"
                value={block.content.name || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, name: e.target.value })}
              />
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Bias Score (Lower is better)</label>
              <input
                type="number"
                className="w-full bg-aic-paper border border-aic-black/5 rounded-xl p-3 text-sm focus:border-aic-gold outline-none transition-all"
                placeholder="0.0 - 1.0"
                value={block.content.bias || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, bias: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-4">
              <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Training Data Demographics</label>
              <textarea
                className="w-full bg-aic-paper border border-aic-black/5 rounded-xl p-3 text-sm focus:border-aic-gold outline-none transition-all h-24"
                placeholder="Describe dataset diversity and collection methodology..."
                value={block.content.demographics || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, demographics: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={async () => {
                const response = await fetch('/api/workspace/export', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: block.content.name,
                    version: '1.0.0',
                    description: 'Generated from AIC Governance Workspace',
                    trainingData: block.content.demographics,
                    biasScore: block.content.bias || 0,
                    accuracy: 98
                  })
                });
                if (response.ok) {
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ModelCard-${block.content.name || 'Export'}.pdf`;
                  a.click();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-aic-black text-aic-paper rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-aic-gold transition-all"
            >
              <FileDown className="w-3 h-3" /> Export ISO Artifact
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
