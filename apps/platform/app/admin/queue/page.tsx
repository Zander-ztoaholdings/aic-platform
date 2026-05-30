"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  FileText, 
  AlertCircle, 
  Clock, 
  Zap,
  Loader2,
  MoreVertical,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Drawer } from "../../components/ui/drawer";
import { cn } from "@/lib/utils";

export default function AdminQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    async function fetchQueue() {
      try {
        const res = await fetch('/api/v1/admin/queue');
        if (res.ok) {
          const data = await res.json();
          setQueue(data);
        }
      } catch (error) {
        console.error("Failed to fetch queue:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchQueue();
  }, []);

  const handleReview = (item: any) => {
    setSelectedUser(item);
    setIsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Unified Submission Queue</h1>
            <p className="text-sm text-gray-500">Triage and manage certification evidence from all portals.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
            <Button className="bg-[#0A1728] text-aic-paper" size="sm">Export Report</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Pending Triage', value: queue.filter(q => q.status === 'UPLOADED').length.toString(), color: 'blue' },
            { label: 'High Risk Flags', value: queue.filter(q => q.risk > 70).length.toString(), color: 'red' },
            { label: 'AI Passed', value: queue.filter(q => q.status === 'AI_TRIAGED').length.toString(), color: 'green' },
            { label: 'Total in Queue', value: queue.length.toString(), color: 'amber' },
          ].map((stat, i) => (
            <Card key={i} className="p-4 border-none shadow-sm">
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Card className="border-none shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-aic-paper">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search by Organization or ID..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm outline-none" />
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-aic-paper">
              <Loader2 className="w-10 h-10 animate-spin text-[#c36c32]" />
              <p className="text-gray-500">Loading submission queue...</p>
            </div>
          ) : (
            <table className="w-full text-left bg-aic-paper">
              <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Submission ID</th>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Document Type</th>
                  <th className="px-6 py-4">AI Triage Status</th>
                  <th className="px-6 py-4">Risk Level</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queue.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => handleReview(item)}
                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id.substring(0,8)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{item.org}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText className="w-4 h-4" /> {item.doc}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {item.status === 'AI_TRIAGED' ? (
                          <Badge className="bg-green-50 text-green-700 border-green-100 gap-1 shadow-none">
                            <Zap className="w-3 h-3" /> AI Scanned
                          </Badge>
                        ) : item.status === 'AI_FAILED' ? (
                          <Badge className="bg-red-50 text-red-700 border-red-100 gap-1 shadow-none">
                            <AlertCircle className="w-3 h-3" /> Flagged
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-100 gap-1 shadow-none">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-xs font-bold ${
                        item.risk > 70 ? 'text-red-600' : 
                        item.risk > 40 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {item.risk > 70 ? 'High' : item.risk > 40 ? 'Medium' : 'Low'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 bg-aic-paper font-serif italic">
                      Queue is currently clear. All certifications are up to date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Review Drawer */}
      <Drawer
        isOpen={isDrawerOpen && selectedItem}
        onClose={() => setIsDrawerOpen(false)}
        title="Audit Evidence Triage"
      >
        {selectedItem && (
          <div className="space-y-8">
            <div>
              <div className="text-[10px] font-bold text-[#c36c32] uppercase tracking-widest mb-1">Organization</div>
              <h4 className="text-xl font-black text-[#0A1728]">{selectedItem.org}</h4>
              <p className="text-xs text-gray-400 font-mono mt-1">{selectedItem.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">AI Risk Score</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black", selectedItem.risk > 70 ? "text-red-600" : "text-[#0A1728]")}>
                    {selectedItem.risk}
                  </span>
                  <span className="text-xs text-gray-400">/100</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <Badge variant="outline" className="shadow-none border-gray-200 bg-aic-paper">
                  {selectedItem.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#c36c32]" /> AI Triage Findings
              </h5>
              <div className="p-4 bg-[#0A1728] text-aic-paper rounded-xl shadow-lg shadow-gray-200">
                <p className="text-xs leading-relaxed text-aic-paper/80 italic">
                  "Automated scan detected <strong>missing digital signatures</strong> on page 4. Summary statistics for 'Gender Parity' are present but <strong>raw covariance matrix</strong> is missing from Annex C."
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Direct Actions</h5>
              <div className="flex flex-col gap-2">
                <Button className="bg-green-600 hover:bg-green-700 text-aic-paper w-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Evidence
                </Button>
                <Button variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 w-full">
                  <XCircle className="w-4 h-4 mr-2" /> Request Revision
                </Button>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Audit Log</h5>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">AI</div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Automated Triage Complete</p>
                    <p className="text-gray-400">10 minutes ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0A1728] flex items-center justify-center text-[10px] font-bold text-aic-paper">RA</div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Root Admin viewed submission</p>
                    <p className="text-gray-400">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
