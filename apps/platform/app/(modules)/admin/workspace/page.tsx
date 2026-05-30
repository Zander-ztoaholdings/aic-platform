'use client';

import React, { useState, useEffect } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion, AnimatePresence } from 'framer-motion';
import { EmpathySlider } from './components/EmpathySlider';
import { GovernanceBlock, GovernanceBlockData, BlockType } from './components/GovernanceBlock';
import { Plus, Eye, EyeOff, LayoutPanelLeft, Save, FileText, UserCheck, Box, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export default function GovernanceWorkspace() {
  const [impactMagnitude, setImpactMagnitude] = useState(3);
  const [blocks, setBlocks] = useState<GovernanceBlockData[]>([]);
  const [systems, setSystems] = useState<any[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load AI Systems
  useEffect(() => {
    fetch('/api/ai-systems')
      .then(res => res.json())
      .then(data => {
        setSystems(data.systems || []);
        if (data.systems?.length > 0) {
          setSelectedSystemId(data.systems[0].id);
        } else {
          setIsLoading(false);
        }
      });
  }, []);

  // Load workspace state for the selected system
  useEffect(() => {
    if (!selectedSystemId) return;
    setIsLoading(true);
    fetch(`/api/workspace?systemId=${selectedSystemId}`)
      .then(res => res.json())
      .then(data => {
        if (data.blocks && data.blocks.length > 0) {
          setBlocks(data.blocks);
          const firstBlockWithImpact = data.blocks.find((b: any) => b.impactMagnitude);
          if (firstBlockWithImpact) {
            setImpactMagnitude(firstBlockWithImpact.impactMagnitude);
          }
        } else {
          const sysName = systems.find(s => s.id === selectedSystemId)?.name || 'System';
          setBlocks([
            { id: '1', type: 'text', content: { text: `Governance trail initialization for ${sysName}. ISO 42001 compliance scope defined.` } }
          ]);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [selectedSystemId]);

  // Logic: Force-inject Human Context Block when Impact > 7
  useEffect(() => {
    if (impactMagnitude > 7 && !isLoading) {
      const hasMandatoryBlock = blocks.some(b => b.type === 'human-context' && b.isMandatory);
      if (!hasMandatoryBlock) {
        const newBlock: GovernanceBlockData = {
          id: `mandatory-${Date.now()}`,
          type: 'human-context',
          content: { rationale: '' },
          isMandatory: true
        };
        setBlocks(prev => [newBlock, ...prev]);
      }
    }
  }, [impactMagnitude, isLoading]);

  const addBlock = (type: BlockType) => {
    const newBlock: GovernanceBlockData = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: {}
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const updateBlock = (id: string, content: any) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const saveWorkspace = async () => {
    if (!selectedSystemId) return;
    setIsSaving(true);
    try {
      await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          blocks, 
          impactMagnitude, 
          systemId: selectedSystemId 
        })
      });
    } catch (error) {
      console.error('Failed to commit blocks', error);
    }
    setIsSaving(false);
  };

  const getBackgroundColor = () => {
    if (impactMagnitude <= 3) return 'rgba(20, 184, 166, 0.03)'; // teal-500
    if (impactMagnitude <= 7) return 'rgba(217, 119, 6, 0.03)'; // amber-600
    return 'rgba(185, 28, 28, 0.05)'; // red-700
  };

  const getBorderColor = () => {
    if (impactMagnitude <= 3) return 'border-teal-500/20';
    if (impactMagnitude <= 7) return 'border-amber-600/20';
    return 'border-red-700/20';
  };

  const WorkspaceContent = (
    <div 
      className={cn(
        "min-h-screen transition-colors duration-1000 ease-in-out p-8 md:p-12",
        isFocusMode ? "fixed inset-0 z-50 bg-aic-paper overflow-y-auto" : ""
      )}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Workspace Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <LayoutPanelLeft className="w-5 h-5 text-aic-gold" />
              <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-[0.4em]">
                ISO 42001 Governance Workspace
              </span>
            </div>
            <h1 className="text-5xl font-serif font-bold text-aic-black tracking-tighter leading-none">
              Algorithm Audit Trail.
            </h1>
            
            {/* System Selector */}
            <div className="flex items-center gap-4 p-2 bg-aic-paper/50 backdrop-blur-sm rounded-2xl border border-aic-black/5 w-fit shadow-sm">
              <Box className="w-4 h-4 text-aic-gold ml-2" />
              <select 
                value={selectedSystemId || ''} 
                onChange={(e) => setSelectedSystemId(e.target.value)}
                className="bg-transparent border-none text-[10px] font-mono font-bold uppercase tracking-widest outline-none py-2 pr-8 cursor-pointer"
              >
                {systems.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.lifecycleStage})</option>
                ))}
                {systems.length === 0 && <option disabled>No Systems Registered</option>}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="flex items-center gap-2 px-4 py-2 bg-aic-paper border border-aic-black/5 rounded-2xl text-[10px] font-mono font-bold uppercase tracking-widest hover:border-aic-gold transition-all shadow-sm"
            >
              {isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isFocusMode ? 'Exit Focus' : 'Focus Mode'}
            </button>
            <button 
              onClick={saveWorkspace}
              disabled={isSaving || !selectedSystemId}
              className="flex items-center gap-2 px-6 py-2 bg-aic-black text-aic-paper rounded-2xl text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-aic-gold transition-all disabled:opacity-50 shadow-lg"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Securing...' : 'Commit Block'}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-aic-gold" />
            <p className="font-serif italic text-gray-400">Syncing governance blocks...</p>
          </div>
        ) : (
          <>
            {/* Empathy Controller */}
            <section className={cn("border-t border-b py-8 transition-colors duration-1000", getBorderColor())}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-sm text-center md:text-left">
                  <h3 className="font-serif text-xl font-bold mb-2">Human Impact Context</h3>
                  <p className="text-sm text-gray-500 italic">
                    Adjusting the magnitude increases the empathy requirements for this governance session.
                  </p>
                </div>
                <EmpathySlider value={impactMagnitude} onChange={setImpactMagnitude} />
              </div>
            </section>

            {/* Blocks Area */}
            <section className="space-y-6">
              <AnimatePresence>
                {blocks.map((block) => (
                  <GovernanceBlock 
                    key={block.id} 
                    block={block} 
                    impactMagnitude={impactMagnitude}
                    onUpdate={updateBlock}
                    onDelete={deleteBlock}
                  />
                ))}
              </AnimatePresence>

              {/* Add Block Menu */}
              <div className="pt-8 flex items-center justify-center gap-4">
                <button 
                  onClick={() => addBlock('text')}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-2xl text-[9px] font-mono font-bold uppercase text-gray-400 hover:border-aic-gold hover:text-aic-gold transition-all"
                >
                  <Plus className="w-3 h-3" /> Add Text
                </button>
                <button 
                  onClick={() => addBlock('model-card')}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-2xl text-[9px] font-mono font-bold uppercase text-gray-400 hover:border-aic-gold hover:text-aic-gold transition-all"
                >
                  <FileText className="w-3 h-3" /> Model Card
                </button>
              </div>
            </section>

            {/* Compliance Guardrail */}
            {impactMagnitude > 7 && (
              <motion.footer 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 bg-red-700 text-aic-paper rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-8"
              >
                <div className="p-4 bg-aic-paper/10 rounded-2xl">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div className="text-center md:text-left">
                  <h4 className="font-serif text-2xl font-bold mb-1">Human-In-The-Loop Enforcement Active</h4>
                  <p className="text-sm text-aic-paper/80 italic font-serif">
                    This audit session is now in "High Magnitude" mode. ISO 42001 certification requires verified human qualitative rationale before this trail can be finalized.
                  </p>
                </div>
              </motion.footer>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <DashboardShell>
      {WorkspaceContent}
    </DashboardShell>
  );
}
