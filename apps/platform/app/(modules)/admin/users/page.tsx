'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import { toast } from 'sonner';
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Drawer } from "@/app/components/ui/drawer";
import { cn } from "@/lib/utils";
import { 
  UserPlus, 
  Search, 
  Shield, 
  MoreVertical, 
  Loader2,
  Mail,
  Building,
  UserCheck,
  Calendar,
  Lock,
  History
} from "lucide-react";

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerMode, setDrawerMode] = useState<'create' | 'view' | null>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: 'VIEWER',
        org_id: ''
    });

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/v1/admin/users');
            const data = await res.json();
            setUsers(data || []);
        } catch {
            toast.error('Failed to sync institutional users.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrgs = async () => {
        try {
            const res = await fetch('/api/v1/admin/organizations');
            const data = await res.json();
            setOrganizations(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchOrgs();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/v1/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                toast.success('User registered in registry.');
                setDrawerMode(null);
                setNewUser({ name: '', email: '', password: '', role: 'VIEWER', org_id: '' });
                fetchUsers();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Registration failed.');
            }
        } catch {
            toast.error('Network error during registration.');
        }
    };

    return (
        <AdminShell>
            <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Institutional Registry</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Global user management and identity provisioning.
                        </p>
                    </div>
                    <Button 
                        onClick={() => setDrawerMode('create')}
                        className="bg-[#0A1728] text-aic-paper hover:bg-[#1a3160]"
                    >
                        <UserPlus className="w-4 h-4 mr-2" /> Register New Identity
                    </Button>
                </div>

                <div className="bg-aic-paper border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-h-[600px]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Search registry by name or email..." className="pl-10 bg-aic-paper border-gray-200 shadow-none h-9 text-xs" />
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-aic-paper border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Identity</th>
                                <th className="px-6 py-4">Institutional Scope</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Access Level</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-[#c36c32] mx-auto mb-2" /><p className="text-xs text-gray-400">Synchronizing with registry...</p></td></tr>
                            ) : users.map((user) => (
                                <tr 
                                    key={user.id} 
                                    onClick={() => { setSelectedUser(user); setDrawerMode('view'); }}
                                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                                                {user.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{user.name}</p>
                                                <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                                            <Building className="w-3.5 h-3.5 text-gray-400" />
                                            {user.orgName || 'AIC GLOBAL'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={user.isActive ? "bg-green-50 text-green-700 border-green-100 shadow-none" : "bg-red-50 text-red-700 border-red-100 shadow-none"}>
                                            {user.isActive ? 'ACTIVE' : 'SUSPENDED'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                            <Shield className="w-3.5 h-3.5 text-[#c36c32]" />
                                            {user.role}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Drawer */}
            <Drawer 
                isOpen={drawerMode === 'create'} 
                onClose={() => setDrawerMode(null)}
                title="Register New Identity"
            >
                <form onSubmit={handleCreateUser} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Full Name</label>
                            <Input 
                                placeholder="e.g. Dr. Helena Thorne"
                                className="bg-gray-50 border-gray-100"
                                value={newUser.name}
                                onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Compliance Email</label>
                            <Input 
                                type="email"
                                placeholder="h.thorne@mfg.com"
                                className="bg-gray-50 border-gray-100"
                                value={newUser.email}
                                onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Initial Password</label>
                            <Input 
                                type="password"
                                className="bg-gray-50 border-gray-100"
                                value={newUser.password}
                                onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Access Level (Fallback Role)</label>
                            <select 
                                className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#c36c32]/20 outline-none"
                                value={newUser.role}
                                onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                            >
                                <option value="VIEWER">VIEWER</option>
                                <option value="AUDITOR">AUDITOR</option>
                                <option value="COMPLIANCE_OFFICER">OFFICER</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Organization Scope</label>
                            <select 
                                className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#c36c32]/20 outline-none"
                                value={newUser.org_id}
                                onChange={e => setNewUser(prev => ({ ...prev, org_id: e.target.value }))}
                            >
                                <option value="">Global (No Organization)</option>
                                {organizations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-gray-100 space-y-3">
                        <Button type="submit" className="w-full bg-[#0A1728] text-aic-paper">Provision Identity</Button>
                        <Button variant="ghost" type="button" onClick={() => setDrawerMode(null)} className="w-full text-gray-400">Cancel</Button>
                    </div>
                </form>
            </Drawer>

            {/* View User Detail Drawer */}
            <Drawer
                isOpen={drawerMode === 'view' && selectedUser}
                onClose={() => setDrawerMode(null)}
                title="Identity Insight"
            >
                {selectedUser && (
                    <div className="space-y-8">
                        <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-20 h-20 rounded-full bg-aic-paper shadow-sm flex items-center justify-center text-3xl font-black text-[#0A1728] mb-4">
                                {selectedUser.name[0]}
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 leading-none">{selectedUser.name}</h4>
                            <p className="text-xs text-gray-400 mt-2 font-mono uppercase tracking-tighter">{selectedUser.id}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-aic-paper border border-gray-100 rounded-xl">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", selectedUser.isActive ? "bg-green-500" : "bg-red-500")} />
                                    <span className="text-sm font-bold text-gray-700">{selectedUser.isActive ? 'Active' : 'Suspended'}</span>
                                </div>
                            </div>
                            <div className="p-4 bg-aic-paper border border-gray-100 rounded-xl">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Access Level</p>
                                <div className="flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5 text-[#c36c32]" />
                                    <span className="text-sm font-bold text-gray-700">{selectedUser.role}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Institutional Activity</h5>
                            <div className="flex items-start gap-3">
                                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-700 font-medium">Last Login</p>
                                    <p className="text-xs text-gray-400">Feb 25, 2026 • 14:22 UTC</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <UserCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-700 font-medium">MFA Status</p>
                                    <p className="text-xs text-green-600 font-bold">Enabled (TOTP)</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100 grid grid-cols-2 gap-3">
                            <Button variant="outline" className="text-red-600 border-red-100 hover:bg-red-50">
                                <Lock className="w-4 h-4 mr-2" /> Suspend
                            </Button>
                            <Button variant="outline">
                                <History className="w-4 h-4 mr-2" /> Audit Trail
                            </Button>
                        </div>
                    </div>
                )}
            </Drawer>
        </AdminShell>
    );
}
