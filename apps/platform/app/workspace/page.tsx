'use client';

import React, { useState, useEffect } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion, AnimatePresence } from 'framer-motion';
import { EmpathySlider } from './components/EmpathySlider';
import { GovernanceBlock, GovernanceBlockData, BlockType } from './components/GovernanceBlock';
import { SovereignButton, ButtonState } from '../components/SovereignButton';
import { 
  Plus, 
  Eye, 
  EyeOff, 
  LayoutPanelLeft, 
  FileText, 
  UserCheck, 
  Box, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck,
  Zap,
  Lock
} from 'lucide-react';
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
  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [promoteState, setPromoteState] = useState<ButtonState>('idle');
  const [isLoading, setIsLoading] = useState(true);

  const selectedSystem = systems.find(s => s.id === selectedSystemId);

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
    setSaveState('loading');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          blocks, 
          impactMagnitude, 
          systemId: selectedSystemId 
        })
      });
      if (res.ok) {
        setSaveState('success');
        setTimeout(() => setSaveState('idle'), 2000);
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  };

  const promoteSystem = async () => {
    if (!selectedSystemId) return;
    setPromoteState('loading');
    try {
      const res = await fetch(`/api/ai-systems/${selectedSystemId}/promote`, {
        method: 'POST'
      });
      if (res.ok) {
        setPromoteState('success');
        // Refresh systems list
        const sysRes = await fetch('/api/ai-systems');
        const sysData = await sysRes.json();
        setSystems(sysData.systems || []);
        setTimeout(() => setPromoteState('idle'), 2000);
      } else {
        setPromoteState('error');
      }
    } catch {
      setPromoteState('error');
    }
  };

  const getBackgroundColor = () => {
    if (impactMagnitude <= 3) return 'rgba(0, 245, 255, 0.01)'; // Cyan tint
    if (impactMagnitude <= 7) return 'rgba(212, 175, 55, 0.02)'; // Gold tint
    return 'rgba(196, 30, 58, 0.03)'; // Red tint
  };

  const getAccentColor = () => {
    if (impactMagnitude <= 3) return 'text-[#8a6a1f]';
    if (impactMagnitude <= 7) return 'text-[#8a6a1f]';
    return 'text-aic-red';
  };

  const WorkspaceContent = (
    <div 
      className={cn(
        "min-h-screen transition-colors duration-1000 ease-in-out p-8 md:p-12",
        isFocusMode ? "fixed inset-0 z-50 bg-[#050505] overflow-y-auto" : ""
      )}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Workspace Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <LayoutPanelLeft className="w-5 h-5 text-[#8a6a1f]" />
              <span className="text-[12px] font-bold text-aic-slate first-cap">
                ISO 42001 Governance Workspace
              </span>
            </div>
            <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">
              Algorithm Audit Trail<span className={getAccentColor()}>.</span>
            </h1>
            
            <div className="flex items-center gap-4">
              {/* System Selector */}
              <div className="flex items-center gap-4 p-2 bg-[#f5f7f9] backdrop-blur-sm rounded-xl border border-[#dde2e8] w-fit shadow-sm">
                <Box className="w-4 h-4 text-[#8a6a1f] ml-2" />
                <select 
                  value={selectedSystemId || ''} 
                  onChange={(e) => setSelectedSystemId(e.target.value)}
                  className="bg-transparent border-none text-[12px] font-bold first-cap outline-none py-2 pr-8 cursor-pointer text-[#0e1b2c]"
                >
                  {systems.map(s => (
                    <option key={s.id} value={s.id} className="bg-white">{s.name}</option>
                  ))}
                  {systems.length === 0 && <option disabled>No Systems Registered</option>}
                </select>
              </div>

              {/* Sandbox Indicator */}
              {selectedSystem && (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border text-[12px] font-bold first-cap",
                  selectedSystem.isSandbox 
                    ? "bg-aic-slate/10 border-aic-slate/30 text-aic-slate" 
                    : "bg-green-50 border-green-200 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                )}>
                  {selectedSystem.isSandbox ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {selectedSystem.isSandbox ? "Sandbox Mode" : "Formal Audit Active"}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:justify-end">
            <SovereignButton 
              variant="secondary"
              onClick={() => setIsFocusMode(!isFocusMode)}
              leftIcon={isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            >
              {isFocusMode ? 'Exit focus' : 'Focus Mode'}
            </SovereignButton>

            {selectedSystem?.isSandbox && (
              <SovereignButton 
                variant="primary"
                state={promoteState}
                onClick={promoteSystem}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                Promote to Formal
              </SovereignButton>
            )}

            <SovereignButton 
              variant="primary"
              state={saveState}
              onClick={saveWorkspace}
              disabled={!selectedSystemId}
              leftIcon={<Lock className="w-4 h-4" />}
            >
              Sync hash
            </SovereignButton>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#8a6a1f]" />
            <p className="text-sm text-[#5e6b7b]">Loading…</p>
          </div>
        ) : (
          <>
            {/* Empathy Controller */}
            <section className="border-t border-[#dde2e8] py-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 bg-[#f5f7f9] p-5 md:p-8 rounded-xl border border-[#dde2e8]">
                <div className="max-w-sm text-center md:text-left">
                  <h3 className="font-serif text-2xl font-bold mb-3 text-[#0e1b2c]">Human Impact Context</h3>
                  <p className="text-sm text-aic-slate italic">
                    Increasing magnitude enforces stricter HITL (Human-in-the-loop) requirements for ISO 42001 certification.
                  </p>
                </div>
                <EmpathySlider value={impactMagnitude} onChange={setImpactMagnitude} />
              </div>
            </section>

            {/* Blocks Area */}
            <section className="space-y-8">
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
              <div className="pt-12 flex items-center justify-center gap-6">
                <button 
                  onClick={() => addBlock('text')}
                  className="group flex items-center gap-3 px-4 sm:px-6 py-3 border border-dashed border-[#dde2e8] rounded-2xl text-[12px] font-bold first-cap text-aic-slate hover:border-aic-cyan hover:text-[#8a6a1f] transition-all"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Add rationale
                </button>
                <button 
                  onClick={() => addBlock('model-card')}
                  className="group flex items-center gap-3 px-4 sm:px-6 py-3 border border-dashed border-[#dde2e8] rounded-2xl text-[12px] font-bold first-cap text-aic-slate hover:border-aic-cyan hover:text-[#8a6a1f] transition-all"
                >
                  <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" /> Model document
                </button>
              </div>
            </section>

            {/* Compliance Guardrail */}
            {impactMagnitude > 7 && (
              <motion.footer 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 md:p-10 bg-aic-red/10 border border-aic-red/30 text-[#0e1b2c] rounded-xl flex flex-col md:flex-row items-center gap-10 overflow-hidden relative group"
              >
                <div className="absolute inset-0 bg-aic-red/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-5 bg-aic-red/20 rounded-2xl relative z-10">
                  <UserCheck className="w-10 h-10 text-aic-red shadow-[0_0_20px_rgba(196,30,58,0.5)]" />
                </div>
                <div className="text-center md:text-left relative z-10">
                  <h4 className="font-serif text-3xl font-bold mb-2">Human-In-The-Loop Enforcement</h4>
                  <p className="text-base text-[#5e6b7b] italic font-serif max-w-2xl">
                    High magnitude detected. The sovereign ledger now requires verified qualitative rationale. Substantive review mode is active.
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
