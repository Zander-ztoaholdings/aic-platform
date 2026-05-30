'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, Info, Check } from 'lucide-react';
import { Eyebrow } from './Eyebrow';

interface UploadModalProps {
  label: string;
  onClose: () => void;
}

export function UploadModal({ label, onClose }: UploadModalProps) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
  }, []);

  const handleSubmit = async () => {
    setBusy(true);
    // Placeholder: replace with real upload API call
    await new Promise((r) => setTimeout(r, 1600));
    setDone(true);
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 bg-[#0a1628]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-[fadeUp_0.2s_ease]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e5e7eb] flex items-start justify-between">
          <div>
            <Eyebrow>Submit Evidence</Eyebrow>
            <h2 className="font-serif text-lg font-bold text-[#0f1f3d] leading-snug">{label}</h2>
            <p className="text-xs text-[#6b7280] mt-1">
              Hashed &amp; timestamped on submission. AIC confirms receipt within 2 business days (DOC-011).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#6b7280] hover:text-[#0f1f3d] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {done ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-serif text-base font-bold text-[#0f1f3d] mb-2">Submitted Successfully</h3>
              <p className="text-sm text-[#6b7280] mb-6">
                {files.length} file{files.length !== 1 ? 's' : ''} logged. Evidence receipt (DOC-011) generated.
              </p>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-5 py-2.5"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragging
                    ? 'border-[#c9920a] bg-amber-50'
                    : 'border-[#e5e7eb] bg-[#f9fafb] hover:border-[#c9920a]/50'
                }`}
              >
                <Upload className={`w-7 h-7 mx-auto mb-2 ${dragging ? 'text-[#c9920a]' : 'text-[#9ca3af]'}`} />
                <p className="text-sm font-semibold text-[#0f1f3d] mb-1">
                  Drop files or <span className="text-[#c9920a]">browse</span>
                </p>
                <p className="font-mono text-[9px] text-[#9ca3af] uppercase tracking-[0.15em]">
                  PDF · DOCX · XLSX · PNG — max 50MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#c9920a] flex-shrink-0" />
                      <span className="flex-1 text-xs font-medium text-[#0f1f3d] truncate">{file.name}</span>
                      <span className="font-mono text-[9px] text-[#9ca3af]">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                        className="text-[#9ca3af] hover:text-[#0f1f3d]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Warning */}
              <div className="mt-4 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2.5 flex gap-2">
                <Info className="w-3.5 h-3.5 text-[#c9920a] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#0f1f3d] leading-relaxed">
                  Submission confirms evidence accurately reflects current governance. False submissions may void
                  certification under DOC-004.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={onClose}
                  className="flex-none inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280] border border-[#e5e7eb] rounded-full px-5 py-2.5 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={files.length === 0 || busy}
                  className="flex-1 inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#b07d08] transition-colors"
                >
                  {busy ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3" />
                      Submit {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : ''}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
