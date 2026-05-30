"use client";

import { useState } from "react";
import { 
  Heart, 
  ShieldAlert, 
  CheckCircle2, 
  Zap, 
  MessageSquare, 
  Loader2,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { motion } from "framer-motion";

export default function EmpathyDemo() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyzeEmpathy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/empathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch {
      console.error("Empathy analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-2 text-[#c36c32] mb-1">
            <Heart className="w-5 h-5 fill-current" />
            <span className="text-xs font-bold uppercase tracking-widest">Right to Empathy</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0A1728]">Empathy Scrutiny Engine (B0-2)</h1>
          <p className="text-gray-500 max-w-2xl">Analyze automated rejection letters and AI-generated communications for violations of human dignity and emotional intelligence.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Input Area */}
          <div className="space-y-6">
            <Card className="p-6 border-none shadow-sm">
              <h3 className="font-bold text-[#0A1728] mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#c36c32]" />
                Communication Draft
              </h3>
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the automated rejection email or notification text here..."
                className="w-full h-64 bg-gray-50 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#c36c32]/20 resize-none border-none"
              />
              <div className="mt-4 flex justify-between items-center">
                <div className="text-xs text-gray-400">Supported standards: ISO/IEC 42001, POPIA Sec 71</div>
                <Button 
                  onClick={analyzeEmpathy}
                  disabled={loading || !text}
                  className="bg-[#0A1728] text-aic-paper px-8"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Analyze for Dignity
                </Button>
              </div>
            </Card>

            <div className="p-6 bg-aic-paper rounded-2xl border border-blue-100 flex items-start gap-4 shadow-sm">
              <ShieldAlert className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-blue-900 mb-1">Why Empathy Matters</h4>
                <p className="text-xs text-blue-700 leading-relaxed">AIC's Empathy Engine ensures that "cold" algorithmic decisions do not dehumanize the end-user. We scan for tone, clarity of recourse, and empathetic language.</p>
              </div>
            </div>
          </div>

          {/* Result Area */}
          <div className="space-y-6">
            {result ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="p-8 border-none shadow-md overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#c36c32]"></div>
                  
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase mb-1">Dignity Score</div>
                      <div className="text-5xl font-black text-[#0A1728]">
                        {Math.round(result.score * 100)}<span className="text-[#c36c32] font-normal text-2xl">%</span>
                      </div>
                    </div>
                    <Badge className={result.score > 0.7 ? "bg-green-500" : "bg-red-500"}>
                      {result.score > 0.7 ? "Passed" : "Action Required"}
                    </Badge>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-sm text-[#0A1728] mb-3 uppercase tracking-tighter">AI Analysis Findings</h4>
                      <div className="space-y-2">
                        {result.violations?.length > 0 ? (
                          result.violations.map((v: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                              <AlertTriangle className="w-4 h-4" /> {v}
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" /> No dignity violations detected.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-bold text-xs text-gray-400 mb-2 uppercase">Auditor Suggestion</h4>
                      <p className="text-sm text-gray-700 italic">"{result.suggestion}"</p>
                    </div>

                    <Button variant="outline" className="w-full border-gray-200 text-[#0A1728] group">
                      Attach to Compliance Report <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-200 rounded-3xl opacity-50">
                <Heart className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="font-bold text-gray-400">Analysis Results</h3>
                <p className="text-sm text-gray-400">Run the scrutiny engine to see results here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
