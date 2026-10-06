"use client";
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useState, useEffect } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import { 
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
    <AdminShell>
    <div>
      <div>
        <header className="mb-8">
          <Eyebrow>Administration</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Permissions</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">What each staff role may do. A change takes effect straight away for everyone who holds that role.</p>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-[#8a6a1f]" />
            <p className="text-gray-500">Initializing permission engine...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
            {/* Navigation Sidebar */}
            <div className="lg:col-span-3 space-y-2">
              <button 
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'roles' ? 'bg-aic-paper shadow-md border-l-4 border-[#a8772a] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  <span className="font-semibold">Roles</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTab('capabilities')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'capabilities' ? 'bg-aic-paper shadow-md border-l-4 border-[#a8772a] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5" />
                  <span className="font-semibold">Capabilities</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeTab === 'audit' ? 'bg-aic-paper shadow-md border-l-4 border-[#a8772a] text-[#0A1728]' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5" />
                  <span className="font-semibold">Change log</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Main Workspace */}
            <div className="lg:col-span-9 bg-aic-paper rounded-2xl shadow-sm border border-gray-100 min-h-[600px] overflow-hidden">
              {activeTab === 'roles' && (
                <div className="flex h-full">
                  {/* Role List */}
                  <div className="w-1/3 border-r border-gray-100 p-4 sm:p-6">
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input type="text" placeholder="Search roles..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm" />
                    </div>
                    <div className="space-y-3">
                      {roles.map(role => (
                        <button 
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${selectedRole?.id === role.id ? 'border-[#a8772a] bg-[#a8772a]/5 shadow-sm' : 'border-gray-50 hover:border-gray-200'}`}
                        >
                          <div className="font-bold text-[#0A1728]">{role.name}</div>
                          <div className="text-[12px] text-gray-500 first-cap">{role.slug}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role Detail/Capability Toggle */}
                  <div className="flex-1 p-5 md:p-8 overflow-y-auto max-h-[800px]">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-[#0A1728]">{selectedRole?.name}</h2>
                        <p className="text-gray-500 text-sm">Configure granular capabilities for this role.</p>
                      </div>
                      {selectedRole?.isCustom && (
                        <button className="text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-6">
                      {categories.map(category => (
                        <div key={category as string}>
                          <h3 className="text-xs font-bold text-gray-500 first-cap mb-4">{category as string}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availableCapabilities.filter(c => c.category === category).map(cap => {
                              const isEnabled = selectedRole?.capabilities?.includes(cap.slug) || selectedRole?.slug === 'super_admin';
                              return (
                                <div key={cap.slug} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 opacity-100">
                                  <div>
                                    <div className="text-sm font-semibold text-[#0A1728]">{cap.name}</div>
                                    <div className="text-[11.5px] text-gray-500 font-mono">{cap.slug}</div>
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
                <div className="p-5 md:p-8">
                  <h2 className="text-2xl font-bold text-[#0A1728] mb-6">Capabilities</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availableCapabilities.map(cap => (
                      <Card key={cap.id} className="p-4 border-gray-100 shadow-none bg-gray-50/50">
                        <div className="text-xs font-bold text-[#8a6a1f] first-cap mb-1">{cap.category}</div>
                        <div className="font-bold text-[#0A1728]">{cap.name}</div>
                        <div className="text-[11.5px] text-gray-500 font-mono mt-1">{cap.slug}</div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div className="p-5 md:p-8 text-center py-20">
                  <History className="w-8 h-8 text-[#9aa5b1] mx-auto mb-3" />
                  <h2 className="text-base font-semibold text-[#0e1b2c] mb-2">No permission log yet</h2>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto">Changes to roles are not yet recorded in a log of their own. Changes to individual accounts are recorded on the Users page.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 p-4 sm:p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">Changes apply immediately</h4>
            <p className="text-amber-700 text-sm leading-relaxed">
              Removing a capability from a role takes it away from every staff member with that role at their next request. Check who holds the role before you change it.            </p>
          </div>
        </div>
      </div>
    </div>
    </AdminShell>
  );
}
