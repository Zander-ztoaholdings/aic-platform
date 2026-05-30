"use client";

import { useState, useEffect } from "react";
import { 
  CreditCard, 
  UserCheck, 
  MoreHorizontal, 
  Search,
  Filter,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Zap,
  ArrowUpRight
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOrgs = async () => {
    try {
      const res = await fetch('/api/v1/admin/organizations');
      if (res.ok) {
        setOrgs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const updateOrg = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/v1/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast.success("Organization updated successfully");
        fetchOrgs();
      }
    } catch {
      toast.error("Failed to update organization");
    }
  };

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#0A1728]">Master Toggle: Organization Control</h1>
            <p className="text-gray-500">Global tenant management and capability overrides.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Advanced Filter</Button>
            <Button className="bg-[#0A1728] text-aic-paper">Provision New Tenant</Button>
          </div>
        </header>

        <Card className="border-none shadow-sm overflow-hidden min-h-[600px]">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-aic-paper">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company name, slug or Stripe ID..." 
                className="pl-10 border-gray-100 bg-gray-50"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-3 bg-aic-paper">
              <Loader2 className="w-10 h-10 animate-spin text-[#c36c32]" />
              <p className="text-gray-500">Loading master organization table...</p>
            </div>
          ) : (
            <table className="w-full text-left bg-aic-paper">
              <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Tier / Plan</th>
                  <th className="px-6 py-4">Billing Status</th>
                  <th className="px-6 py-4">Certification Status</th>
                  <th className="px-6 py-4">Readiness</th>
                  <th className="px-6 py-4">Last Update</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-[#0A1728] font-bold">
                          {org.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            {org.name}
                            {org.isAlpha && <Badge className="text-[8px] h-4 bg-[#c36c32]">Alpha</Badge>}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{org.id.substring(0,8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-700">{org.tier}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{org.planId || 'No Plan'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => updateOrg(org.id, { billingStatus: org.billingStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE' })}
                        className="cursor-pointer"
                      >
                        <Badge className={
                          org.billingStatus === 'ACTIVE' ? "bg-green-50 text-green-700 border-green-100" :
                          org.billingStatus === 'PAST_DUE' ? "bg-red-50 text-red-700 border-red-100" :
                          "bg-gray-50 text-gray-700"
                        }>
                          {org.billingStatus}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          org.certificationStatus === 'CERTIFIED' ? 'bg-green-500' :
                          org.certificationStatus === 'PENDING_REVIEW' ? 'bg-amber-500' :
                          'bg-gray-300'
                        }`}></span>
                        <span className="text-sm font-medium text-gray-600">{org.certificationStatus}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-[#c36c32]" style={{ width: `${org.iso42001Readiness}%` }}></div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 font-bold">{org.iso42001Readiness}% Ready</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600"><ExternalLink className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-[#c36c32]"><Zap className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Global Capability Insights */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="p-6 bg-[#0A1728] text-aic-paper">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#c36c32]" /> Revenue Velocity
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">$42,800</span>
              <span className="text-green-400 text-sm font-bold flex items-center"><ArrowUpRight className="w-4 h-4" /> 14%</span>
            </div>
            <p className="text-xs text-aic-paper/40 mt-2 italic">Real-time delta vs. previous 30 days.</p>
          </Card>

          <Card className="p-6 bg-aic-paper border-none shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#c36c32]" /> Auditor Distribution
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Senior Auditor A', load: '84%', status: 'Max' },
                { name: 'Junior Auditor B', load: '42%', status: 'Avail' },
              ].map((a, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{a.name}</span>
                  <Badge variant="outline" className="text-[10px]">{a.load} Load</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-aic-paper border-none shadow-sm flex flex-col justify-center items-center text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <h3 className="font-bold text-gray-900">3 At-Risk Renewals</h3>
            <p className="text-xs text-gray-500 mb-4">Organizations failing preliminary scans this month.</p>
            <Button size="sm" variant="outline" className="w-full">View At-Risk Report</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
