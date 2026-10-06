import { describe, it, expect } from 'vitest';
import { readByRules, extractSupplierText, readSupplierDocument } from '@/lib/ai/supplier-doc';
import { documentConcerns, docOutOfDate, STALE_DOC_FLAG } from '@/lib/registers/suppliers';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const supplier = { name: 'Acme Cloud', purpose: 'Hosting', outsideSa: true, hasDpa: false, dataShared: ['personal'] };

const SOC2 = `SOC 2 Type II Report
Independent Service Auditor's Report, prepared by Example Assurance LLP
Report on Acme Cloud's description of its hosting system for the period 1 January 2025 to 31 December 2025.
Exceptions noted: One exception was noted in CC6.2 where terminated user access was not removed within 24 hours.
Data is processed in the United States and Ireland.`;

const ISO = `CERTIFICATE OF REGISTRATION
This is to certify that Acme Cloud operates an Information Security Management System which complies with ISO/IEC 27001:2022.
Certificate number 12345. Original issue: 2024-03-01. Expiry date: 2025-02-28.`;

describe('supplier document rules reader', () => {
  it('reads a SOC 2 Type 2 report', () => {
    const f = readByRules(SOC2, supplier, NOW);
    expect(f.kind).toBe('soc2_type2');
    expect(f.coversTo).toBe('2025-12-31');
    expect(f.exceptions.length).toBeGreaterThan(0);
  });
  it('reads an ISO certificate and sees it has expired', () => {
    const f = readByRules(ISO, supplier, NOW);
    expect(f.kind).toBe('iso27001');
    expect(f.expires).toBe('2025-02-28');
    expect(f.concerns.join(' ')).toMatch(/expired/i);
  });
  it('raises the missing agreement for personal information abroad', () => {
    expect(readByRules(SOC2, supplier, NOW).concerns.join(' ')).toMatch(/agreement|DPA|POPIA/i);
  });
  it('accepts text files and refuses others', () => {
    expect(extractSupplierText('a.txt', Buffer.from('hello'))).toEqual({ text: 'hello' });
    expect('error' in extractSupplierText('a.exe', Buffer.from(''))).toBe(true);
  });
  it('says so plainly for a PDF when the AI service is off', async () => {
    const r = await readSupplierDocument({ text: '', pdf: Buffer.from('%PDF'), fileName: 'soc2.pdf', supplier, now: NOW });
    expect(r.readBy).toBe('rules');
    expect(r.findings.readNote).toMatch(/PDF/);
  });
});

describe('documentConcerns', () => {
  it('flags only when the newest document is out of date', () => {
    expect(docOutOfDate({ expires: '2025-01-01', coversTo: null }, NOW)).toBe('expired');
    expect(docOutOfDate({ expires: null, coversTo: '2025-06-30' }, NOW)).toBe('stale');
    expect(documentConcerns([
      { createdAt: '2026-01-01', findings: { expires: '2025-01-01' } },
      { createdAt: '2026-09-01', findings: { expires: '2027-09-01' } },
    ], NOW)).toEqual([]);
    expect(documentConcerns([{ createdAt: '2026-09-01', findings: { coversTo: '2024-12-31' } }], NOW)).toEqual([STALE_DOC_FLAG]);
  });
});
