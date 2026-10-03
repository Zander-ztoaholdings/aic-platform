'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function GovernancePage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = () => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || [])
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleProvision = async () => {
    const name = prompt("Full Name:");
    if (!name) return;
    const email = prompt("Email:");
    if (!email) return;
    const password = prompt("Temporary Password:");
    if (!password) return;
    // 4-tier model (2026-09): AIC's own personnel are AIC_SUPER_ADMIN or
    // AIC_AUDITOR now, not ADMIN/AUDITOR/VIEWER - see lib/roles.ts.
    const role = prompt("Role (AIC_SUPER_ADMIN, AIC_AUDITOR):", "AIC_AUDITOR");
    if (!role) return;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                email, 
                password, 
                role,
                permissions: {
                    view_dashboard: true,
                    view_crm: role === 'AIC_SUPER_ADMIN',
                    view_cms: role === 'AIC_SUPER_ADMIN',
                    view_audits: true,
                    verify_evidence: role === 'AIC_AUDITOR' || role === 'AIC_SUPER_ADMIN',
                    view_academy: true
                }
            })
        });

        if (response.ok) {
            alert("Personnel provisioned successfully.");
            fetchUsers();
        }
    } catch (err) {
        console.error(err);
        alert("Provisioning failed.");
    }
  }

  const handleTogglePermission = async (userId: string, permission: string, currentVal: boolean) => {
      // In a real app, this would be a PATCH to /api/users
      // Mocking state update for immediate feedback
      setUsers(prev => prev.map(u => {
          if (u.id === userId) {
              const newPerms = { ...u.permissions, [permission]: !currentVal };
              return { ...u, permissions: newPerms };
          }
          return u;
      }));
      console.log(`Setting ${permission} to ${!currentVal} for user ${userId}`);
  };

  const permissionKeys = [
      { id: 'view_crm', label: 'CRM' },
      { id: 'view_cms', label: 'CMS' },
      { id: 'view_audits', label: 'Audits' },
      { id: 'verify_evidence', label: 'Verify' },
      { id: 'view_academy', label: 'Academy' }
  ];

  return (
      <div className="max-w-6xl space-y-12">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-8">
            <div>
                <h1 className="text-3xl md:text-4xl font-serif font-medium tracking-tight underline decoration-aic-gold underline-offset-8">Institutional Control</h1>
                <p className="text-gray-500 font-serif mt-4 italic text-lg max-w-xl">Super-Admin Governance: Managing team access, roles, and functional permissions across the AIC ecosystem.</p>
            </div>
            <button 
                onClick={handleProvision}
                className="bg-[#0e1b2c] text-white px-5 md:px-8 py-3 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-colors shadow-xl"
            >
                + Provision New Account
            </button>
        </div>

        <div className="bg-white border border-[#dde2e8] rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left text-sm font-serif">
                <thead className="bg-[#f5f7f9] border-b border-[#dde2e8]">
                    <tr>
                        <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">User Details</th>
                        <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap">Role</th>
                        <th className="p-4 sm:p-6 text-[12px] font-bold text-gray-500 first-cap text-center">Advanced Permissions</th>
                        <th className="p-4 sm:p-6 text-right text-[12px] font-bold text-gray-500 first-cap">Last Access</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e9ee]">
                    {loading ? (
                        <tr><td colSpan={4} className="p-6 md:p-12 text-center text-gray-500 font-serif italic">Accessing personnel database...</td></tr>
                    ) : users.map((user, _i) => (
                        <motion.tr 
                            key={user.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-[#eef1f5] transition-colors group"
                        >
                            <td className="p-4 sm:p-6">
                                <p className="font-bold text-[#0e1b2c] text-lg leading-none mb-1">
                                    {user.name} {user.is_super_admin && <span className="text-[11px] text-[#8a6a1f] border border-aic-gold/20 px-1 ml-2 font-mono">SUPER</span>}
                                </p>
                                <p className="text-[11.5px] font-mono text-gray-500">{user.email}</p>
                            </td>
                            <td className="p-4 sm:p-6">
                                <span className={`text-[12px] first-cap px-2 py-0.5 rounded border ${
                                    user.role === 'AIC_SUPER_ADMIN' ? 'border-aic-gold text-[#8a6a1f] bg-aic-gold/5' : 'border-[#dde2e8] text-gray-500'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="p-4 sm:p-6">
                                <div className="flex justify-center gap-3">
                                    {permissionKeys.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleTogglePermission(user.id, p.id, user.permissions?.[p.id])}
                                            className={`flex flex-col items-center gap-1 group/btn`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border transition-all ${
                                                user.permissions?.[p.id] ? 'bg-aic-gold border-aic-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'bg-transparent border-[#dde2e8]'
                                            }`} />
                                            <span className={`text-[12px] first-cap transition-colors ${
                                                user.permissions?.[p.id] ? 'text-[#8a6a1f]' : 'text-gray-600 group-hover/btn:text-gray-400'
                                            }`}>{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </td>
                            <td className="p-4 sm:p-6 text-right">
                                <span className="text-[12px] text-gray-500 first-cap">
                                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                </span>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table></div>
        </div>
      </div>
  )
}
