"use client";

import { useState } from "react";
import { Search, Book, HelpCircle, ShieldCheck, Activity } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

const ARTICLES = [
  { title: "Uploading ISO 42001 Model Cards", cat: "Documentation" },
  { title: "Understanding Your Risk Score", cat: "Compliance" },
  { title: "Managing Human Overrides", cat: "Admin" },
  { title: "Renewing Your Annual Certification", cat: "Lifecycle" },
];

export default function SupportCenter() {
  const [query, setQuery] = useState("");

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1600px] mx-auto px-8 py-12">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-[#0A1728] mb-4">Autonomous Support Center</h1>
          <p className="text-gray-500 mb-8">Self-service resources to accelerate your certification journey.</p>
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 py-6 text-lg rounded-2xl shadow-sm border-none bg-aic-paper" 
              placeholder="Search knowledge base (e.g. 'how to upload evidence')..."
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-[#0A1728] mb-6 flex items-center gap-2">
                <Book className="w-5 h-5 text-[#c36c32]" /> Recommended Guides
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ARTICLES.map((art, i) => (
                  <Card key={i} className="p-6 hover:shadow-md transition-shadow cursor-pointer border-none shadow-sm group">
                    <div className="text-[10px] uppercase font-bold text-[#c36c32] mb-2">{art.cat}</div>
                    <h3 className="font-bold text-[#0A1728] group-hover:text-[#c36c32] transition-colors">{art.title}</h3>
                  </Card>
                ))}
              </div>
            </section>

            <Card className="p-8 bg-[#0A1728] text-aic-paper overflow-hidden relative border-none">
              <ShieldCheck className="absolute -bottom-10 -right-10 w-48 h-48 text-aic-paper/5" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-4">AIC Automated Assistant</h2>
                <p className="text-aic-paper/60 mb-6 max-w-lg">Our AI support agent is trained on the ISO/IEC 42001 standard and AIC's internal policies. Ask it anything about your audit.</p>
                <Button className="bg-[#c36c32] hover:bg-[#c36c32]">Start Chat Session</Button>
              </div>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="p-6 border-none shadow-sm">
              <h3 className="font-bold text-[#0A1728] mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" /> System Status
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Vault Uploads', status: 'Operational' },
                  { label: 'AI Triage Engine', status: 'Operational' },
                  { label: 'Sovereign Sync', status: 'Operational' },
                ].map((s, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{s.label}</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-wider">{s.status}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm bg-amber-50">
              <HelpCircle className="w-8 h-8 text-amber-600 mb-4" />
              <h3 className="font-bold text-amber-900 mb-2">Still need help?</h3>
              <p className="text-sm text-amber-700 mb-4">Final proctored exams require human scheduling. Click below to book your session with an AIC auditor.</p>
              <Button variant="outline" className="w-full border-amber-200 text-amber-800 hover:bg-amber-100">Book Auditor Slot</Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
