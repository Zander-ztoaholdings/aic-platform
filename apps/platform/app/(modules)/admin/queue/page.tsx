"use client";
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useState, useEffect } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import { 
  Search, 
  FileText, 
  AlertCircle, 
  Clock, 
  Zap,
  Loader2,
  MoreVertical,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Drawer } from "@/app/components/ui/drawer";
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
    <AdminShell>
    <div>
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6 md:mb-8">
          <Eyebrow>Assessments</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Review queue</h1>
          <p className="mt-1 text-sm text-[#5e6b7b]">Evidence submitted by clients, waiting for review.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          {[
            { label: 'Waiting for triage', value: queue.filter(q => q.status === 'UPLOADED').length.toString(), color: 'blue' },
            { label: 'Flagged high risk', value: queue.filter(q => q.risk > 70).length.toString(), color: 'red' },
            { label: 'Passed first read', value: queue.filter(q => q.status === 'AI_TRIAGED').length.toString(), color: 'green' },
            { label: 'In the queue', value: queue.length.toString(), color: 'amber' },
          ].map((stat, i) => (
            <Card key={i} className="p-4 gap-1 bg-[#f5f7f9] border border-[#dde2e8] shadow-none text-[#0e1b2c]">
              <div className="text-[12.5px] font-medium text-[#5e6b7b]">{stat.label}</div>
              <div className="text-2xl font-bold text-[#0e1b2c] tabular-nums">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Card className="border-none shadow-sm overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-aic-paper">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search by organisation or reference" className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm outline-none" />
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-aic-paper">
              <Loader2 className="w-10 h-10 animate-spin text-[#8a6a1f]" />
              <p className="text-gray-500">Loading submission queue...</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-aic-paper"><table className="w-full min-w-[760px] text-left bg-aic-paper">
              <thead className="bg-gray-50/50 text-[12px] first-cap font-bold text-gray-500">
                <tr>
                  <th className="px-4 sm:px-6 py-4">Reference</th>
                  <th className="px-4 sm:px-6 py-4">Organization</th>
                  <th className="px-4 sm:px-6 py-4">Document</th>
                  <th className="px-4 sm:px-6 py-4">First read</th>
                  <th className="px-4 sm:px-6 py-4">Risk</th>
                  <th className="px-4 sm:px-6 py-4">Submitted</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queue.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => handleReview(item)}
                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-4 font-mono text-xs text-gray-500">{item.id.substring(0,8)}</td>
                    <td className="px-4 sm:px-6 py-4 font-bold text-gray-900">{item.org}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText className="w-4 h-4" /> {item.doc}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
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
                    <td className="px-4 sm:px-6 py-4">
                      <div className={`text-xs font-bold ${
                        item.risk > 70 ? 'text-red-600' : 
                        item.risk > 40 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {item.risk > 70 ? 'High' : item.risk > 40 ? 'Medium' : 'Low'}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-xs text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 sm:px-6 py-12 text-center text-gray-500 bg-aic-paper font-serif italic">
                      Nothing is waiting for review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
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
              <div className="text-[12px] font-bold text-[#8a6a1f] first-cap mb-1">Organization</div>
              <h4 className="text-xl font-black text-[#0A1728]">{selectedItem.org}</h4>
              <p className="text-xs text-gray-500 font-mono mt-1">{selectedItem.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">AI Risk Score</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black", selectedItem.risk > 70 ? "text-red-600" : "text-[#0A1728]")}>
                    {selectedItem.risk}
                  </span>
                  <span className="text-xs text-gray-500">/100</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">Status</p>
                <Badge variant="outline" className="shadow-none border-gray-200 bg-aic-paper">
                  {selectedItem.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-[12px] font-bold text-gray-500 first-cap border-b border-gray-100 pb-2 flex items-center gap-2">
                <Zap className="w-3 h-3 text-[#8a6a1f]" /> AI Triage Findings
              </h5>
              <div className="p-4 bg-white text-[#0e1b2c] rounded-xl shadow-lg shadow-gray-200">
                <p className="text-xs leading-relaxed text-[#5e6b7b] italic">
                  "Automated scan detected <strong>missing digital signatures</strong> on page 4. Summary statistics for 'Gender Parity' are present but <strong>raw covariance matrix</strong> is missing from Annex C."
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h5 className="text-[12px] font-bold text-gray-500 first-cap border-b border-gray-100 pb-2">Direct Actions</h5>
              <div className="flex flex-col gap-2">
                <Button className="bg-green-600 hover:bg-green-700 text-aic-paper w-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Evidence
                </Button>
                <Button variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 w-full">
                  <XCircle className="w-4 h-4 mr-2" /> Send back for changes
                </Button>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h5 className="text-[12px] font-bold text-gray-500 first-cap border-b border-gray-100 pb-2">Audit Log</h5>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[11.5px] font-bold text-gray-500">AI</div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Automated Triage Complete</p>
                    <p className="text-gray-500">10 minutes ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[11.5px] font-bold text-[#0e1b2c]">RA</div>
                  <div className="text-xs">
                    <p className="text-gray-900 font-medium">Root Admin viewed submission</p>
                    <p className="text-gray-500">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
    </AdminShell>
  );
}
