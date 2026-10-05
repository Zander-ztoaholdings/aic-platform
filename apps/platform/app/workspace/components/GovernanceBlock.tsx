'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, UserCheck, Trash2, Info, FileDown, Cpu, Database } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SovereignButton } from '../../components/SovereignButton';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative p-5 md:p-8 bg-[#f5f7f9] rounded-[2rem] border border-[#dde2e8] transition-all duration-500 hover:bg-[#eef1f5] hover:border-[#dde2e8]",
        block.isMandatory && "border-l-4 border-l-aic-red bg-aic-red/[0.02]"
      )}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-xl bg-[#f5f7f9] border border-[#dde2e8] text-aic-slate group-hover:text-[#8a6a1f] transition-colors",
            block.type === 'human-context' && "text-aic-red bg-aic-red/10 border-aic-red/20",
            block.type === 'model-card' && "text-[#8a6a1f] bg-aic-gold/10 border-aic-gold/20"
          )}>
            {block.type === 'human-context' && <UserCheck className="w-5 h-5" />}
            {block.type === 'model-card' && <Shield className="w-5 h-5" />}
            {block.type === 'text' && <Activity className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-[12px] font-bold text-aic-slate first-cap">
              {block.type.replace('-', ' ')} {block.isMandatory && "(MANDATORY)"}
            </span>
            <p className="text-[12px] text-gray-600 first-cap mt-1">
              Block ID: {block.id.substring(0, 8)}
            </p>
          </div>
        </div>
        
        {!block.isMandatory && (
          <button 
            onClick={() => onDelete(block.id)}
            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-aic-red/20 text-aic-red rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {block.type === 'text' && (
        <textarea
          className="w-full bg-transparent border-none focus:ring-0 font-serif text-xl text-[#5e6b7b] placeholder:text-aic-slate/30 resize-none min-h-[120px] outline-none leading-relaxed"
          placeholder="Enter governance rationale..."
          value={block.content.text || ''}
          onChange={(e) => onUpdate(block.id, { ...block.content, text: e.target.value })}
        />
      )}

      {block.type === 'human-context' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-aic-red/5 rounded-2xl border border-aic-red/20">
            <Info className="w-5 h-5 text-aic-red" />
            <p className="text-xs text-aic-red/80 font-medium">
              CRITICAL: High Impact ({impactMagnitude}/10) requires qualitative human agency rationale.
            </p>
          </div>
          <textarea
            className="w-full bg-[#f5f7f9] border border-[#dde2e8] rounded-2xl p-4 sm:p-6 font-serif text-xl text-[#0e1b2c] focus:border-aic-red/50 outline-none transition-all placeholder:text-[#8a95a3]"
            placeholder="Describe stakeholder impact and ethical mitigation..."
            value={block.content.rationale || ''}
            onChange={(e) => onUpdate(block.id, { ...block.content, rationale: e.target.value })}
          />
        </div>
      )}

      {block.type === 'model-card' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 bg-[#f5f7f9] p-5 md:p-8 rounded-xl border border-dashed border-[#dde2e8]">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[12px] font-bold text-aic-slate first-cap">
                <Cpu className="w-3 h-3" /> Model Designation
              </label>
              <input
                className="w-full bg-[#f5f7f9] border border-[#dde2e8] rounded-xl p-4 text-sm text-[#0e1b2c] focus:border-aic-gold/50 outline-none transition-all"
                placeholder="e.g. CreditRisk-v4"
                value={block.content.name || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, name: e.target.value })}
              />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[12px] font-bold text-aic-slate first-cap">
                <Shield className="w-3 h-3" /> Bias Threshold (0-1)
              </label>
              <input
                type="number"
                className="w-full bg-[#f5f7f9] border border-[#dde2e8] rounded-xl p-4 text-sm text-[#0e1b2c] focus:border-aic-gold/50 outline-none transition-all"
                placeholder="0.0 - 1.0"
                value={block.content.bias || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, bias: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-4">
              <label className="flex items-center gap-2 text-[12px] font-bold text-aic-slate first-cap">
                <Database className="w-3 h-3" /> Training Data Demographics
              </label>
              <textarea
                className="w-full bg-[#f5f7f9] border border-[#dde2e8] rounded-xl p-4 text-sm text-[#0e1b2c] focus:border-aic-gold/50 outline-none transition-all h-32 leading-relaxed"
                placeholder="Describe dataset diversity and bias mitigation methodology..."
                value={block.content.demographics || ''}
                onChange={(e) => onUpdate(block.id, { ...block.content, demographics: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <SovereignButton 
              variant="secondary"
              className="border-aic-gold/30 text-[#8a6a1f] hover:bg-aic-gold/10"
              onClick={async () => {
                const response = await fetch('/api/workspace/export', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: block.content.name,
                    version: '1.0.0',
                    description: 'Generated from Sovereign AIC Workspace',
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
              leftIcon={<FileDown className="w-4 h-4" />}
            >
              Generate Artifact
            </SovereignButton>
          </div>
        </div>
      )}
    </motion.div>
  );
};
