'use client';

import { useState, useEffect } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function OrganizationalSettings() {
    const [settings, setSettings] = useState({
        name: '',
        tier: '',
        contactEmail: '',
        integrityScore: 0,
        isAlpha: false,
        twoFactorEnabled: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [keys, setKeys] = useState<Array<{ id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null }>>([]);
    const [loadingKeys, setLoadingKeys] = useState(true);
    const [newKeyLabel, setNewKeyLabel] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState('VIEWER');
    const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
    const [mfaSetup, setMfaSetup] = useState<{ secret: string, qrCode: string } | null>(null);
    const [mfaToken, setMfaToken] = useState('');
    const [isMfaEnabling, setIsMfaEnabling] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                setSettings({
                    name: data.name || '',
                    tier: data.tier || 'TIER_3',
                    contactEmail: data.contactEmail || '',
                    integrityScore: data.integrityScore || 0,
                    isAlpha: data.isAlpha || false,
                    twoFactorEnabled: data.twoFactorEnabled || false,
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));

        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        setLoadingKeys(true);
        try {
            const res = await fetch('/api/keys');
            const data = await res.json();
            setKeys(data.keys || []);
        } finally {
            setLoadingKeys(false);
        }
    };

    const handleGenerateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newKeyLabel || 'Default Key' })
            });
            if (res.ok) {
                const data = await res.json();
                setGeneratedKey(data.apiKey);
                setNewKeyLabel('');
                toast.success('Access credentials generated successfully.');
                fetchKeys();
            }
        } finally {
            setSaving(false);
        }
    };

    const startMfaSetup = async () => {
        try {
            const res = await fetch('/api/auth/mfa/setup');
            const data = await res.json();
            if (res.ok) {
                setMfaSetup(data);
            } else {
                toast.error(data.error || 'Failed to start MFA setup');
            }
        } catch {
            toast.error('Network error during MFA setup');
        }
    };

    const completeMfaSetup = async () => {
        if (!mfaSetup || !mfaToken) return;
        setIsMfaEnabling(true);
        try {
            const res = await fetch('/api/auth/mfa/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: mfaSetup.secret, token: mfaToken })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('MFA enabled successfully');
                setMfaSetup(null);
                setMfaToken('');
                // Refresh settings to show MFA as active
                window.location.reload();
            } else {
                toast.error(data.error || 'Verification failed');
            }
        } finally {
            setIsMfaEnabling(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: settings.name })
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, name: data.name }));
                toast.success('Organizational profile updated.');
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to update settings');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardShell>
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex justify-between items-end border-b border-aic-black/5 pb-8">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-aic-black tracking-tight tracking-tighter">Organizational Standards</h1>
                        <p className="text-gray-500 font-serif mt-4 italic text-lg leading-relaxed">
                            Configure your institutional profile and security protocols.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-400 italic font-serif">Loading organizational settings...</div>
                ) : (
                <div className="grid grid-cols-1 gap-12">
                    {/* Institutional Profile */}
                    <section className="bg-aic-paper border border-aic-black/5 p-10 rounded-[2.5rem] shadow-xl">
                        <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-10">Institutional Profile</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Entity Name</label>
                                <input
                                    className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                    value={settings.name}
                                    onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Compliance Tier</label>
                                <div className="px-4 py-3 bg-aic-black text-aic-paper font-mono text-[10px] font-bold rounded-xl inline-block">
                                    {settings.tier}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Primary Compliance Email</label>
                                <input
                                    className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                    value={settings.contactEmail}
                                    readOnly
                                />
                            </div>
                        </div>
                    </section>

                    {/* Team Management */}
                    <section className="bg-aic-paper border border-aic-black/5 p-10 rounded-[2.5rem] shadow-xl">
                        <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-10">Team Management</h3>
                        
                        {generatedInvite && (
                            <div className="mb-10 p-6 bg-aic-black text-aic-paper rounded-2xl border border-aic-paper/10">
                                <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-widest mb-3">INVITATION LINK READY</p>
                                <div className="flex items-center gap-4">
                                    <code className="flex-1 bg-aic-paper/5 border border-aic-paper/10 p-4 rounded-xl font-mono text-xs break-all">
                                        {generatedInvite}
                                    </code>
                                    <button 
                                        onClick={() => setGeneratedInvite(null)}
                                        className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest hover:text-aic-paper"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <p className="text-[10px] font-mono text-gray-500 mt-3 uppercase italic">Share this link with your team member to grant access.</p>
                            </div>
                        )}

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setSaving(true);
                            try {
                                const res = await fetch('/api/users/invite', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    setGeneratedInvite(data.inviteLink);
                                    setInviteEmail('');
                                    setInviteName('');
                                    toast.success('Institutional invitation link generated.');
                                } else {
                                    toast.error(data.error || 'Failed to generate invitation');
                                }
                            } finally {
                                setSaving(false);
                            }
                        }} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Full Name</label>
                                    <input
                                        className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                        placeholder="Dr. Thabo Mbeki"
                                        value={inviteName}
                                        onChange={e => setInviteName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Institutional Email</label>
                                    <input
                                        className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                        placeholder="thabo@bank.co.za"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Institutional Role</label>
                                    <select
                                        className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all appearance-none"
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                    >
                                        <option value="VIEWER">VIEWER (READ-ONLY)</option>
                                        <option value="AUDITOR">AUDITOR (VERIFICATION)</option>
                                        <option value="COMPLIANCE_OFFICER">COMPLIANCE OFFICER (WRITE)</option>
                                        <option value="ADMIN">ADMINISTRATOR (FULL)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-aic-black text-aic-paper px-8 py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-red transition-all disabled:opacity-50"
                                >
                                    INVITE_TEAM_MEMBER
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Security Protocol */}
                    <section className="bg-[#080808] text-aic-paper p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5 font-serif italic text-6xl select-none uppercase">Security</div>
                        <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-10 relative z-10">Security Protocol</h3>

                        <div className="space-y-8 relative z-10">
                            <div className="p-6 bg-aic-paper/5 border border-aic-paper/10 rounded-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <p className="text-sm font-serif font-bold text-aic-paper mb-1">Multi-Factor Authentication (MFA)</p>
                                        <p className="text-[10px] font-mono text-gray-500 uppercase">Mandatory for {settings.tier} Organizations</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {settings.twoFactorEnabled && <span className="text-[8px] font-mono font-bold text-aic-gold bg-aic-gold/10 px-2 py-1 rounded">ACTIVE</span>}
                                        <button 
                                            onClick={startMfaSetup}
                                            className="bg-aic-paper/10 hover:bg-aic-paper/20 text-aic-paper px-4 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition-all"
                                        >
                                            {settings.twoFactorEnabled ? 'Reset MFA' : 'Configure MFA'}
                                        </button>
                                    </div>
                                </div>

                                {mfaSetup && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="mt-6 pt-6 border-t border-aic-paper/10 space-y-6"
                                    >
                                        <div className="flex flex-col md:flex-row gap-8 items-center">
                                            <div className="bg-aic-paper p-4 rounded-2xl">
                                                <img src={mfaSetup.qrCode} alt="MFA QR Code" className="w-32 h-32" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <p className="text-xs text-gray-400 leading-relaxed font-serif">
                                                    1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)<br/>
                                                    2. Enter the 6-digit verification code below to confirm setup.
                                                </p>
                                                <div className="flex gap-3">
                                                    <input 
                                                        type="text"
                                                        maxLength={6}
                                                        placeholder="000000"
                                                        value={mfaToken}
                                                        onChange={e => setMfaToken(e.target.value)}
                                                        className="bg-aic-paper/5 border border-aic-paper/10 rounded-xl p-3 font-mono text-center tracking-[0.5em] focus:border-aic-gold outline-none w-32"
                                                    />
                                                    <button 
                                                        onClick={completeMfaSetup}
                                                        disabled={isMfaEnabling || mfaToken.length !== 6}
                                                        className="bg-aic-gold text-aic-black px-6 py-3 rounded-xl font-mono text-[10px] font-bold uppercase hover:bg-aic-paper transition-all disabled:opacity-50"
                                                    >
                                                        {isMfaEnabling ? 'Verifying...' : 'Enable MFA'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setMfaSetup(null)}
                                                        className="text-[10px] font-mono font-bold text-gray-500 uppercase hover:text-aic-paper"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="flex justify-between items-center p-6 bg-aic-paper/5 border border-aic-paper/10 rounded-2xl">
                                <div>
                                    <p className="text-sm font-serif font-bold text-aic-paper mb-1">Audit Trail Cryptographic Signing</p>
                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter italic">SHA-256 Chain Verification active</p>
                                </div>
                                <span className="text-[8px] font-mono font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">SECURE</span>
                            </div>
                        </div>
                    </section>

                    {/* Data Residency */}
                    <section className="bg-aic-paper border border-aic-black/5 p-10 rounded-[2.5rem] shadow-xl">
                        <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-10">Jurisdiction & Residency</h3>
                        <div className="flex items-center gap-6 p-6 bg-aic-paper/50 rounded-2xl border border-aic-black/5">
                            <div className="w-12 h-12 rounded-xl bg-aic-paper border border-aic-black/5 flex items-center justify-center text-2xl font-serif font-bold">ZA</div>
                            <div>
                                <p className="text-sm font-serif font-bold text-aic-black mb-1">Sovereign Data Storage</p>
                                <p className="text-[10px] font-mono text-gray-500 uppercase leading-relaxed italic">
                                    Your institutional data is pinned to South African regional nodes to satisfy POPIA cross-border transfer requirements.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Developer API Access */}
                    <section className="bg-aic-paper border border-aic-black/5 p-10 rounded-[2.5rem] shadow-xl">
                        <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-10">Developer API Access</h3>
                        
                        {generatedKey && (
                            <div className="mb-10 p-6 bg-green-50 border border-green-100 rounded-2xl">
                                <p className="text-[10px] font-mono font-bold text-green-600 uppercase tracking-widest mb-3">NEW API KEY GENERATED</p>
                                <div className="flex items-center gap-4">
                                    <code className="flex-1 bg-aic-paper border border-green-200 p-4 rounded-xl font-mono text-sm break-all">
                                        {generatedKey}
                                    </code>
                                    <button 
                                        onClick={() => setGeneratedKey(null)}
                                        className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest hover:text-aic-black"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <p className="text-[10px] font-mono text-green-600 mt-3 uppercase">Store this safely. It will never be shown again.</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            {loadingKeys ? (
                                <div className="text-center py-6 text-gray-400 italic font-serif text-sm">Retrieving access keys...</div>
                            ) : keys.length === 0 ? (
                                <div className="text-center py-10 bg-aic-paper/30 border border-dashed border-aic-black/10 rounded-2xl text-gray-400 italic font-serif text-sm">
                                    No active API keys found.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {keys.map((key) => (
                                        <div key={key.id} className="flex items-center justify-between p-5 bg-aic-paper/50 rounded-2xl border border-aic-black/5">
                                            <div>
                                                <p className="text-sm font-serif font-bold text-aic-black">{key.label}</p>
                                                <p className="text-[10px] font-mono text-gray-500 uppercase mt-1">
                                                    Prefix: {key.key_prefix} • Created {new Date(key.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-mono text-gray-400 uppercase">Last Used</p>
                                                <p className="text-[10px] font-mono font-bold text-aic-black mt-1">
                                                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'NEVER'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleGenerateKey} className="pt-6 border-t border-aic-black/5">
                                <div className="flex gap-4">
                                    <input 
                                        className="flex-1 bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                        placeholder="Key Label (e.g. Production CI/CD)"
                                        value={newKeyLabel}
                                        onChange={e => setNewKeyLabel(e.target.value)}
                                        required
                                    />
                                    <button 
                                        type="submit"
                                        disabled={saving}
                                        className="bg-aic-black text-aic-paper px-8 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                                    >
                                        Generate New Key
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>
                </div>
                )}

                <div className="flex justify-end pt-12 gap-4 items-center">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-aic-black text-aic-paper px-12 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold hover:text-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                        {saving ? 'SAVING...' : 'SAVE_PROTOCOL_CHANGES'}
                    </button>
                </div>
            </div>
        </DashboardShell>
    );
}
