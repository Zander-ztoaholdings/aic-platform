"use client";

import { useState, useEffect } from "react";
import { 
  Shield, 
  Plus, 
  Settings, 
  Lock, 
  History, 
  Search,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Loader2
} from "lucide-react";
import { Card } from "@/app/components/ui/card";

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState<'roles' | 'capabilities' | 'audit'>('roles');
  const [roles, setRoles] = useState<any[]>([]);
  const [availableCapabilities, setAvailableCapabilities] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [rolesRes, capsRes] = await Promise.all([
          fetch('/api/v1/admin/rbac/roles'),
          fetch('/api/v1/admin/rbac/capabilities')
        ]);

        if (rolesRes.ok && capsRes.ok) {
          const rolesData = await rolesRes.json();
          const capsData = await capsRes.json();
          setRoles(rolesData);
          setAvailableCapabilities(capsData);
          if (rolesData.length > 0) setSelectedRole(rolesData[0]);
        }
      } catch (error) {
        console.error("Failed to fetch RBAC data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const categories = Array.from(new Set(availableCapabilities.map(c => c.category)));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-[#c36c32] mb-1">
              <Shield className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">System Integrity</span>
            </div>
            <h1 className="text-3xl font-bold text-[#0A1728]">God Mode: Permission Engine</h1>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-[#0A1728] text-aic-paper px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a3160] transition-all">
              <Plus className="w-4 h-4" /> Create Custom Role
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#c36c32]" />
            <p className="text-gray-500">Initializing permission engine...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Navigation Sidebar */}
            <div className="lg:col-span-3 space-y-2">
              <button 
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'roles' ? 'bg-aic-paper shadow-md border-l-4 border-[#c36c32] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  <span className="font-semibold">Role Management</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTab('capabilities')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'capabilities' ? 'bg-aic-paper shadow-md border-l-4 border-[#c36c32] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5" />
                  <span className="font-semibold">Capability Directory</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'audit' ? 'bg-aic-paper shadow-md border-l-4 border-[#c36c32] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5" />
                  <span className="font-semibold">Permission Audit Log</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Main Workspace */}
            <div className="lg:col-span-9 bg-aic-paper rounded-2xl shadow-sm border border-gray-100 min-h-[600px] overflow-hidden">
              {activeTab === 'roles' && (
                <div className="flex h-full">
                  {/* Role List */}
                  <div className="w-1/3 border-r border-gray-100 p-6">
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Search roles..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm" />
                    </div>
                    <div className="space-y-3">
                      {roles.map(role => (
                        <button 
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${selectedRole?.id === role.id ? 'border-[#c36c32] bg-[#c36c32]/5 shadow-sm' : 'border-gray-50 hover:border-gray-200'}`}
                        >
                          <div className="font-bold text-[#0A1728]">{role.name}</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{role.slug}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role Detail/Capability Toggle */}
                  <div className="flex-1 p-8 overflow-y-auto max-h-[800px]">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-[#0A1728]">{selectedRole?.name}</h2>
                        <p className="text-gray-500 text-sm">Configure granular capabilities for this role.</p>
                      </div>
                      {selectedRole?.isCustom && (
                        <button className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-6">
                      {categories.map(category => (
                        <div key={category as string}>
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{category as string}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableCapabilities.filter(c => c.category === category).map(cap => {
                              const isEnabled = selectedRole?.capabilities?.includes(cap.slug) || selectedRole?.slug === 'super_admin';
                              return (
                                <div key={cap.slug} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 opacity-100">
                                  <div>
                                    <div className="text-sm font-semibold text-[#0A1728]">{cap.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{cap.slug}</div>
                                  </div>
                                  <button 
                                    disabled={selectedRole?.slug === 'super_admin'}
                                    className={`w-12 h-6 rounded-full relative transition-all ${isEnabled ? 'bg-green-500' : 'bg-gray-300'} ${selectedRole?.slug === 'super_admin' ? 'cursor-not-allowed' : ''}`}
                                  >
                                    <div className={`absolute top-1 w-4 h-4 bg-aic-paper rounded-full transition-all ${isEnabled ? 'right-1' : 'left-1'}`} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'capabilities' && (
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-[#0A1728] mb-6">Capability Directory</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availableCapabilities.map(cap => (
                      <Card key={cap.id} className="p-4 border-gray-100 shadow-none bg-gray-50/50">
                        <div className="text-xs font-bold text-[#c36c32] uppercase mb-1">{cap.category}</div>
                        <div className="font-bold text-[#0A1728]">{cap.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-1">{cap.slug}</div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="p-8 text-center py-20">
                  <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-[#0A1728] mb-2">Audit Ledger Coming Soon</h2>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto">Real-time immutable tracking of permission changes is currently being integrated with the Sovereign System Ledger.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 mb-1">Administrative Critical Path</h4>
            <p className="text-amber-700 text-sm leading-relaxed">
              You are currently in <strong>God Mode</strong>. Changes made here bypass standard approval flows and are logged directly to the Sovereign System Ledger. Ensure all custom role creations align with the AIC Personnel Certification Manual.            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
