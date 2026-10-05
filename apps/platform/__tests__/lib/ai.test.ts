// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { deflateRawSync } from 'zlib';
import { extractJson, pool } from '@/lib/ai/claude';
import { recordFacts, aiDraftAnswer } from '@/lib/ai/questionnaire-ai';
import { suggestMappings } from '@/lib/ai/map-requirements';
import { triageDocument, documentContent } from '@/lib/ai/triage';
import { parseTriage } from '@/lib/ai/triage-shared';
import { docxText } from '@/lib/ai/docx-text';
import type { OrgFacts } from '@/lib/org-facts';

const facts: OrgFacts = {
  org: { id: 'o', name: 'Highveld Credit (Demo)', legalName: null, division: 2, website: null },
  badge: null, certificate: null,
  accountablePerson: { name: 'Lerato Dube', jobTitle: 'COO', since: '2026-09-01T00:00:00Z' },
  policies: [{ key: 'information-security', title: 'Information security policy', version: 2, publishedAt: '2026-09-10T00:00:00Z', accepted: 4, members: 5 }],
  connectors: [{ provider: 'github', label: 'GitHub', lastChecked: null }],
  checks: [{ key: 'github.org_2fa_required', subject: 'highveld', status: 'pass', summary: 'Two-factor sign-in is required.', observedAt: null }],
  systems: [], decisions: { last90: 120, overrides: 9 },
};

/** A minimal .docx: a zip with one deflated word/document.xml. */
function makeDocx(xml: string): Buffer {
  const name = Buffer.from('word/document.xml');
  const data = deflateRawSync(Buffer.from(xml));
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const cdStart = local.length + name.length + data.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + name.length, 12); eocd.writeUInt32LE(cdStart, 16);
  return Buffer.concat([local, name, data, central, name, eocd]);
}

const reply = (obj: unknown) => vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(obj) + '\n```' }] }), { status: 200 }));

describe('model plumbing', () => {
  it('pulls JSON out of a reply, fenced or not', () => {
    expect(extractJson('Sure:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":2}} trailing')).toEqual({ a: { b: 2 } });
    expect(() => extractJson('no json')).toThrow();
  });
  it('pool keeps order', async () => {
    expect(await pool([3, 1, 2], 2, async (x) => x * 2)).toEqual([6, 2, 4]);
  });
  it('reads the text of a .docx', () => {
    expect(docxText(makeDocx('<w:document><w:p><w:r><w:t>Backup &amp; restore</w:t></w:r></w:p><w:p><w:t>Tested 2026-08-01</w:t></w:p></w:document>'))).toBe('Backup & restore\nTested 2026-08-01');
    expect(docxText(Buffer.from('not a zip'))).toBeNull();
  });
  it('knows which files it can read', () => {
    expect(documentContent('a.pdf', Buffer.from('x'))?.type).toBe('document');
    expect(documentContent('a.png', Buffer.from('x'))?.type).toBe('image');
    expect(documentContent('a.md', Buffer.from('x'))?.type).toBe('text');
    expect(documentContent('a.xlsx', Buffer.from('x'))).toBeNull();
  });
});

describe('with AI off', () => {
  beforeEach(() => { delete process.env.AIC_AI_API_KEY; });
  it('mapping falls back to keywords and triage does nothing', async () => {
    const r = await suggestMappings([{ id: '1', title: 'Backups are tested yearly' }]);
    expect(r).toEqual({ map: { '1': ['ops.backup'] }, source: 'keywords' });
    expect(await triageDocument({ fileName: 'a.pdf', buf: Buffer.from('x'), purpose: 'p', guidance: null })).toBeNull();
  });
});

describe('with AI on', () => {
  beforeEach(() => { process.env.AIC_AI_API_KEY = 'test'; });
  afterEach(() => { delete process.env.AIC_AI_API_KEY; vi.unstubAllGlobals(); });

  it('record facts are numbered and sourced', () => {
    const r = recordFacts(facts, [{ key: 'ops.backup', title: 'Backups and recovery', status: 'evidenced', documents: 1 }]);
    expect(r.map((f) => f.id)).toEqual(['O1', 'A1', 'P1', 'K1', 'N1', 'D1', 'C1']);
    expect(r.find((f) => f.id === 'C1')!.text).toContain('Backups and recovery');
  });

  it('a grounded draft keeps its sources and is labelled', async () => {
    vi.stubGlobal('fetch', reply({ answer: 'We require two-factor sign-in on GitHub.', used: ['K1', 'ZZ'], status: 'draft', missing: '' }));
    const d = await aiDraftAnswer('Do you enforce 2FA on source control?', recordFacts(facts));
    expect(d!.status).toBe('draft');
    expect(d!.draft).toContain('AI DRAFT');
    expect(d!.sources).toEqual([{ label: 'Automated checks', href: '/checks' }]);
  });

  it('an answer that cites nothing is treated as needing input', async () => {
    vi.stubGlobal('fetch', reply({ answer: 'We are ISO 27001 certified.', used: [], status: 'draft' }));
    const d = await aiDraftAnswer('Are you ISO certified?', recordFacts(facts));
    expect(d!.status).toBe('needs_input');
    expect(d!.draft).not.toContain('ISO 27001 certified');
  });

  it('a model failure returns null so the rules stand', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('overloaded', { status: 529 })));
    expect(await aiDraftAnswer('q', recordFacts(facts))).toBeNull();
  });

  it('mapping drops unknown keys and keeps keywords for missing ids', async () => {
    vi.stubGlobal('fetch', reply({ map: { a: ['iam.mfa', 'made.up', 'iam.mfa'] } }));
    const r = await suggestMappings([{ id: 'a', title: 'Staff use two factors' }, { id: 'b', title: 'Encrypt laptops' }]);
    expect(r.source).toBe('ai');
    expect(r.map.a).toEqual(['iam.mfa']);
    expect(r.map.b).toContain('ops.encryption');
  });

  it('triage is cleaned and stored as JSON', async () => {
    vi.stubGlobal('fetch', reply({ verdict: 'partly', summary: 'A backup schedule.', missing: ['No restore test result'], documentDate: '2026-08-01' }));
    const t = await triageDocument({ fileName: 'backup.txt', buf: Buffer.from('daily backups'), purpose: 'Backups', guidance: 'schedule and restore test' });
    expect(t).toMatchObject({ verdict: 'partly', missing: ['No restore test result'], documentDate: '2026-08-01' });
    expect(parseTriage(JSON.stringify(t))).toMatchObject({ verdict: 'partly' });
    expect(parseTriage('plain old note')).toBeNull();
  });
});
