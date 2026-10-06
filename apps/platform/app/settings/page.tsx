'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { canEditOrgProfile, canManageTeamAndKeys } from '../../lib/roles';

export default function OrganizationalSettings() {
    const { data: session } = useSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const canEditProfile = canEditOrgProfile(role);
    const canManageTeam = canManageTeamAndKeys(role);
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
    const [inviteRole, setInviteRole] = useState('ORG_USER');
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
            <div className="max-w-4xl space-y-6">
                <PageHeader eyebrow="Account" title="Team and organisation" lede="Your organisation’s details as AIC holds them, and the people who can sign in to this workspace." />

                {loading ? (
                    <p className="py-10 text-sm text-[#5e6b7b]">Loading…</p>
                ) : (
                <div className="grid grid-cols-1 gap-5">
                    {/* Institutional Profile */}
                    <section className="bg-white border border-[#dde2e8] p-5 md:p-7 rounded-xl">
                        <h3 className="text-base font-semibold text-[#0e1b2c] mb-5">Organisation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                            <div>
                                <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Organisation name</label>
                                <input
                                    className="w-full bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={settings.name}
                                    disabled={!canEditProfile}
                                    onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Tier</label>
                                <div className="inline-flex h-11 items-center rounded-full border border-[#dde2e8] bg-[#f5f7f9] px-4 text-sm font-medium text-[#0e1b2c]">
                                    {String(settings.tier ?? '').replace('TIER_', 'Tier ')}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Contact email</label>
                                <input
                                    className="w-full bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all"
                                    value={settings.contactEmail}
                                    readOnly
                                />
                            </div>
                        </div>
                    </section>

                    {/* Team Management */}
                    <section className="bg-white border border-[#dde2e8] p-5 md:p-7 rounded-xl">
                        <h3 className="text-base font-semibold text-[#0e1b2c] mb-5">Team</h3>

                        {!canManageTeam ? (
                            <p className="text-sm text-[#5e6b7b]">
                                Only an administrator can invite team members. Ask an admin on your team to add you.
                            </p>
                        ) : (
                        <>
                        {generatedInvite && (
                            <div className="mb-10 p-4 sm:p-6 bg-aic-black text-aic-paper rounded-2xl border border-aic-paper/10">
                                <p className="text-[12px] font-bold text-aic-gold first-cap mb-3">Invitation link ready</p>
                                <div className="flex items-center gap-4">
                                    <code className="flex-1 bg-aic-paper/5 border border-aic-paper/10 p-4 rounded-xl font-mono text-xs break-all">
                                        {generatedInvite}
                                    </code>
                                    <button 
                                        onClick={() => setGeneratedInvite(null)}
                                        className="text-[12px] font-bold text-gray-400 first-cap hover:text-aic-paper"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <p className="text-[12px] text-gray-500 mt-3 first-cap italic">The email could not be sent. Share this link with them directly — it works once and expires in seven days.</p>
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
                                    // The link is only returned when the email could not be sent.
                                    setGeneratedInvite(data.inviteLink ?? null);
                                    setInviteEmail('');
                                    setInviteName('');
                                    if (data.emailed) toast.success(data.message || 'Invitation sent.');
                                    else toast.warning(data.message || 'Invitation created, but the email could not be sent.');
                                } else {
                                    toast.error(data.error || 'Failed to generate invitation');
                                }
                            } finally {
                                setSaving(false);
                            }
                        }} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                <div>
                                    <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Full name</label>
                                    <input
                                        className="w-full bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all"
                                        placeholder="Full name"
                                        value={inviteName}
                                        onChange={e => setInviteName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Email</label>
                                    <input
                                        className="w-full bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all"
                                        placeholder="name@company.com"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-[#5e6b7b] mb-1.5">Role</label>
                                    <select
                                        className="w-full bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all appearance-none"
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                    >
                                        <option value="ORG_USER">Member (day-to-day work)</option>
                                        <option value="ORG_ADMIN">Administrator (full org access)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] px-5 text-white text-sm font-medium hover:bg-[#22344a] disabled:opacity-50"
                                >
                                    Invite team member
                                </button>
                            </div>
                        </form>
                        </>
                        )}
                    </section>

                    {/* Security Protocol */}
                    <section className="bg-white border border-[#dde2e8] text-[#0e1b2c] p-5 md:p-7 rounded-xl">
                        <h3 className="text-base font-semibold text-[#0e1b2c] mb-5 relative z-10">Security</h3>

                        <div className="space-y-8 relative z-10">
                            <div className="p-4 sm:p-6 bg-[#f5f7f9] border border-[#dde2e8] rounded-xl">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[#0e1b2c] mb-1">Two-step sign-in (MFA)</p>
                                        <p className="text-[12px] text-gray-500 first-cap">Required for {String(settings.tier ?? '').replace('TIER_', 'Tier ')} organisations</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {settings.twoFactorEnabled && <span className="text-[12px] font-medium text-[#2f7d4f] bg-[#2f7d4f]/10 px-2.5 py-1 rounded-full">Active</span>}
                                        <button 
                                            onClick={startMfaSetup}
                                            className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] hover:bg-[#22344a] text-white px-5 text-sm font-medium transition-all"
                                        >
                                            {settings.twoFactorEnabled ? 'Reset MFA' : 'Configure MFA'}
                                        </button>
                                    </div>
                                </div>

                                {mfaSetup && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="mt-6 pt-6 border-t border-[#dde2e8] space-y-6"
                                    >
                                        <div className="flex flex-col md:flex-row gap-8 items-center">
                                            <div className="bg-white border border-[#dde2e8] p-3 rounded-xl">
                                                <img src={mfaSetup.qrCode} alt="MFA QR Code" className="w-32 h-32" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <p className="text-[13px] text-[#5e6b7b] leading-relaxed">
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
                                                        className="bg-[#f5f7f9] border border-[#dde2e8] rounded-xl p-3 text-center tracking-[0.5em] focus:border-aic-gold outline-none w-32"
                                                    />
                                                    <button 
                                                        onClick={completeMfaSetup}
                                                        disabled={isMfaEnabling || mfaToken.length !== 6}
                                                        className="bg-aic-gold text-aic-black px-4 sm:px-6 py-3 rounded-xl text-[12px] font-bold first-cap hover:bg-aic-paper transition-all disabled:opacity-50"
                                                    >
                                                        {isMfaEnabling ? 'Verifying...' : 'Enable MFA'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setMfaSetup(null)}
                                                        className="text-[12px] font-bold text-gray-500 first-cap hover:text-[#0e1b2c]"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="flex justify-between items-center gap-4 p-4 sm:p-5 bg-[#f5f7f9] border border-[#dde2e8] rounded-xl">
                                <div>
                                    <p className="text-sm font-semibold text-[#0e1b2c] mb-1">Tamper-evident record</p>
                                    <p className="text-[13px] text-[#5e6b7b]">Each entry in your continuity record is chained to the one before it with SHA-256, so a change to any entry is detectable.</p>
                                </div>
                                <span className="shrink-0 text-[12px] font-medium text-[#2f7d4f] bg-[#2f7d4f]/10 px-2.5 py-1 rounded-full">On</span>
                            </div>
                        </div>
                    </section>

                    {/* Data Residency */}
                    <section className="bg-white border border-[#dde2e8] p-5 md:p-7 rounded-xl">
                        <h3 className="text-base font-semibold text-[#0e1b2c] mb-5">Where your data is kept</h3>
                        <div className="flex items-center gap-6 p-4 sm:p-6 bg-aic-paper/50 rounded-2xl border border-aic-black/5">
                            <div className="w-12 h-12 rounded-xl bg-aic-paper border border-aic-black/5 flex items-center justify-center text-2xl font-serif font-bold">ZA</div>
                            <div>
                                <p className="text-sm font-semibold text-[#0e1b2c] mb-1">Stored in South Africa</p>
                                <p className="text-[13px] text-[#5e6b7b] leading-relaxed">
                                    Your organisation’s data is held in South Africa, so nothing crosses a border that POPIA section 72 would need an agreement for.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* API keys */}
                    <section className="bg-white border border-[#dde2e8] p-5 md:p-7 rounded-xl">
                        <h3 className="text-base font-semibold text-[#0e1b2c] mb-5">Developer API Access</h3>

                        {!canManageTeam ? (
                            <p className="text-sm text-[#5e6b7b]">
                                API keys are managed by an administrator.
                            </p>
                        ) : (
                        <>
                        {generatedKey && (
                            <div className="mb-10 p-4 sm:p-6 bg-green-50 border border-green-100 rounded-2xl">
                                <p className="text-[12px] font-bold text-green-600 first-cap mb-3">New API key created</p>
                                <div className="flex items-center gap-4">
                                    <code className="flex-1 bg-aic-paper border border-green-200 p-4 rounded-xl font-mono text-sm break-all">
                                        {generatedKey}
                                    </code>
                                    <button 
                                        onClick={() => setGeneratedKey(null)}
                                        className="text-[12px] font-bold text-gray-400 first-cap hover:text-aic-black"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <p className="text-[12px] text-green-600 mt-3 first-cap">Store this safely. It will never be shown again.</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            {loadingKeys ? (
                                <div className="py-6 text-sm text-[#5e6b7b]">Loading…</div>
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
                                                <p className="text-[12px] text-gray-500 first-cap mt-1">
                                                    Prefix: {key.key_prefix} • Created {new Date(key.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[12px] text-gray-400 first-cap">Last Used</p>
                                                <p className="text-[11.5px] font-bold text-aic-black mt-1">
                                                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'NEVER'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleGenerateKey} className="pt-6 border-t border-aic-black/5">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input 
                                        className="flex-1 min-w-0 bg-white border border-[#dde2e8] rounded-xl h-11 px-3.5 text-sm text-[#0e1b2c] focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15 outline-none transition-all"
                                        placeholder="What the key is for, e.g. production"
                                        value={newKeyLabel}
                                        onChange={e => setNewKeyLabel(e.target.value)}
                                        required
                                    />
                                    <button 
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-50"
                                    >
                                        Create a new key
                                    </button>
                                </div>
                            </form>
                        </div>
                        </>
                        )}
                    </section>
                </div>
                )}

                {canEditProfile && (
                <div className="flex justify-end pt-12 gap-4 items-center">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] text-white text-sm font-medium hover:bg-[#22344a] disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
                )}
            </div>
        </DashboardShell>
    );
}
