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
    const role = prompt("Role (ADMIN, AUDITOR, VIEWER):", "AUDITOR");
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
                    view_crm: role === 'ADMIN',
                    view_cms: role === 'ADMIN',
                    view_audits: role !== 'VIEWER',
                    verify_evidence: role === 'AUDITOR' || role === 'ADMIN',
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
        <div className="flex justify-between items-end border-b border-aic-paper/5 pb-8">
            <div>
                <h1 className="text-4xl font-serif font-medium tracking-tight underline decoration-aic-gold underline-offset-8">Institutional Control</h1>
                <p className="text-gray-500 font-serif mt-4 italic text-lg max-w-xl">Super-Admin Governance: Managing team access, roles, and functional permissions across the AIC ecosystem.</p>
            </div>
            <button 
                onClick={handleProvision}
                className="bg-aic-paper text-black px-8 py-3 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-colors shadow-xl"
            >
                + Provision New Account
            </button>
        </div>

        <div className="bg-black/40 border border-aic-paper/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left text-sm font-serif">
                <thead className="bg-aic-paper/5 border-b border-aic-paper/5">
                    <tr>
                        <th className="p-6 font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">User Details</th>
                        <th className="p-6 font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                        <th className="p-6 font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Advanced Permissions</th>
                        <th className="p-6 text-right font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest">Last Access</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-aic-paper/5">
                    {loading ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-500 font-serif italic">Accessing personnel database...</td></tr>
                    ) : users.map((user, _i) => (
                        <motion.tr 
                            key={user.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-aic-paper/5 transition-colors group"
                        >
                            <td className="p-6">
                                <p className="font-bold text-aic-paper text-lg leading-none mb-1">
                                    {user.name} {user.is_super_admin && <span className="text-[8px] text-aic-gold border border-aic-gold/20 px-1 ml-2 font-mono">SUPER</span>}
                                </p>
                                <p className="text-[10px] font-mono text-gray-500">{user.email}</p>
                            </td>
                            <td className="p-6">
                                <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                                    user.role === 'ADMIN' ? 'border-aic-gold text-aic-gold bg-aic-gold/5' : 'border-aic-paper/10 text-gray-400'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="p-6">
                                <div className="flex justify-center gap-3">
                                    {permissionKeys.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleTogglePermission(user.id, p.id, user.permissions?.[p.id])}
                                            className={`flex flex-col items-center gap-1 group/btn`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border transition-all ${
                                                user.permissions?.[p.id] ? 'bg-aic-gold border-aic-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'bg-transparent border-aic-paper/20'
                                            }`} />
                                            <span className={`text-[7px] font-mono uppercase transition-colors ${
                                                user.permissions?.[p.id] ? 'text-aic-gold' : 'text-gray-600 group-hover/btn:text-gray-400'
                                            }`}>{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </td>
                            <td className="p-6 text-right">
                                <span className="text-[9px] font-mono text-gray-500 uppercase">
                                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                </span>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
  )
}
