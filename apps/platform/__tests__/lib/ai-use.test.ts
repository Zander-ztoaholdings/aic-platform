// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapClaudeCode, mapClaudeSeats, daysBack, analyticsKeyProblem } from '@/lib/ai-use/anthropic';
import { mapCopilotSeats, mapM365Copilot, looksConcealed } from '@/lib/ai-use/copilot';
import { parseUsageExport, exportDate } from '@/lib/ai-use/import';
import { registerChecks } from '@/lib/ai-use/store';
import { declaredFor } from '@/lib/ai-use/products';
import { mapGemini } from '@/lib/connectors/providers/google_workspace';
import { parseModelIds, parseMetricData } from '@/lib/connectors/providers/aws';
import { mapAzureMetrics } from '@/lib/connectors/providers/azure';
import { mapVertex } from '@/lib/connectors/providers/gcp';

const NOW = new Date('2026-10-07T10:00:00Z');

describe('Anthropic', () => {
  it('reads days ending yesterday, oldest first', () => {
    expect(daysBack(3, NOW)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
  });

  it('adds one person’s Claude Code day together across terminals', () => {
    const rows = [
      { date: '2026-10-06T00:00:00Z', actor: { type: 'user_actor', email_address: 'Dev@Co.com' }, terminal_type: 'vscode',
        core_metrics: { num_sessions: 3, lines_of_code: { added: 100, removed: 10 }, commits_by_claude_code: 2, pull_requests_by_claude_code: 1 },
        tool_actions: { edit_tool: { accepted: 5, rejected: 1 } },
        model_breakdown: [{ model: 'claude-opus-5-5', tokens: { input: 1000, output: 200, cache_read: 0, cache_creation: 0 } }] },
      { date: '2026-10-06T00:00:00Z', actor: { type: 'user_actor', email_address: 'dev@co.com' }, terminal_type: 'iTerm',
        core_metrics: { num_sessions: 2, lines_of_code: { added: 5, removed: 0 } } },
    ];
    const [r] = mapClaudeCode(rows, '2026-10-06');
    expect(r).toMatchObject({ product: 'claude_code', subject: 'dev@co.com', day: '2026-10-06', activity: 5 });
    expect(r.metrics).toMatchObject({ linesAdded: 105, commits: 2, pullRequests: 1, accepted: 5, rejected: 1, tokens: 1200 });
  });

  it('keeps Enterprise users who did something, and drops all-zero rows', () => {
    const rows = [
      { user: { email_address: 'a@co.com' }, last_activity_date: '2026-10-05', chat_metrics: { message_count: 42, distinct_conversation_count: 5 }, claude_code_metrics: { core_metrics: { distinct_session_count: 1 } }, cowork_metrics: { message_count: 3 } },
      { user: { email_address: 'idle@co.com' }, chat_metrics: { message_count: 0 }, claude_code_metrics: { core_metrics: { distinct_session_count: 0 } }, cowork_metrics: { message_count: 0 } },
    ];
    const out = mapClaudeSeats(rows, '2026-10-05');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subject: 'a@co.com', activity: 45, lastActiveAt: '2026-10-05T00:00:00Z' });
    expect(out[0].metrics).toMatchObject({ conversations: 5, codeSessions: 1, coworkMessages: 3 });
  });

  it('refuses an Admin key where an Analytics key is needed', () => {
    expect(analyticsKeyProblem('sk-ant-admin01-xyz')).toMatch(/Admin key/);
    expect(analyticsKeyProblem('ak-123')).toBeNull();
  });
});

describe('Copilot', () => {
  it('turns GitHub seats into people with a last-active date and editor', () => {
    const [s] = mapCopilotSeats([{ assignee: { login: 'octocat' }, last_activity_at: '2026-10-01T08:00:00Z', last_activity_editor: 'vscode/1.77.3/copilot/1.86.82', plan_type: 'business' }, { assignee: null }], NOW);
    expect(s).toMatchObject({ product: 'github_copilot', subject: 'octocat', day: '2026-10-07', lastActiveAt: '2026-10-01T08:00:00Z' });
    expect(s.metrics).toMatchObject({ editor: 'vscode', plan: 'business' });
  });

  it('lists the Microsoft 365 apps each person used Copilot in, and spots hidden names', () => {
    const { records, concealed } = mapM365Copilot([
      { reportRefreshDate: '2026-10-05', userPrincipalName: 'U@co.com', displayName: 'U', lastActivityDate: '2026-10-05', wordCopilotLastActivityDate: '2026-10-01', microsoftTeamsCopilotLastActivityDate: '2026-10-05', excelCopilotLastActivityDate: '' },
    ], NOW);
    expect(concealed).toBe(false);
    expect(records[0]).toMatchObject({ subject: 'u@co.com', day: '2026-10-05', lastActiveAt: '2026-10-05T00:00:00Z' });
    expect(records[0].metrics?.apps).toBe('Teams, Word');
    expect(looksConcealed('0123456789ABCDEF0123456789ABCDEF')).toBe(true);
    expect(mapM365Copilot([{ userPrincipalName: '0123456789ABCDEF0123456789ABCDEF' }], NOW).concealed).toBe(true);
  });
});

describe('Gemini in Workspace', () => {
  it('counts actions per person per day, ignoring opens with nothing asked', () => {
    const out = mapGemini([
      { id: { time: '2026-10-06T09:00:00Z' }, actor: { email: 'A@co.com' }, events: [{ name: 'feature_utilization', parameters: [{ name: 'app_name', value: 'docs' }, { name: 'event_category', value: 'active_generate' }] }] },
      { id: { time: '2026-10-06T11:00:00Z' }, actor: { email: 'a@co.com' }, events: [{ name: 'feature_utilization', parameters: [{ name: 'app_name', value: 'gmail' }, { name: 'event_category', value: 'active_summarize' }] }] },
      { id: { time: '2026-10-06T12:00:00Z' }, actor: { email: 'b@co.com' }, events: [{ name: 'feature_utilization', parameters: [{ name: 'app_name', value: 'gmail' }, { name: 'event_category', value: 'inactive' }] }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subject: 'a@co.com', day: '2026-10-06', activity: 2, lastActiveAt: '2026-10-06T11:00:00Z' });
    expect(out[0].metrics?.apps).toBe('docs, gmail');
  });
});

describe('Cloud AI services', () => {
  it('reads Bedrock model ids and daily sums from CloudWatch', () => {
    const list = '<ListMetricsResponse><ListMetricsResult><Metrics><member><Namespace>AWS/Bedrock</Namespace><MetricName>Invocations</MetricName><Dimensions><member><Name>ModelId</Name><Value>anthropic.claude-sonnet</Value></member></Dimensions></member><member><Dimensions></Dimensions></member></Metrics></ListMetricsResult></ListMetricsResponse>';
    expect(parseModelIds(list)).toEqual(['anthropic.claude-sonnet']);
    const data = '<GetMetricDataResponse><GetMetricDataResult><MetricDataResults><member><Id>m0_invocations</Id><Label>x</Label><Timestamps><member>2026-10-05T00:00:00Z</member><member>2026-10-06T00:00:00Z</member></Timestamps><Values><member>12.0</member><member>3.0</member></Values><StatusCode>Complete</StatusCode></member><member><Id>m0_inputtokencount</Id><Timestamps><member>2026-10-06T00:00:00Z</member></Timestamps><Values><member>900.0</member></Values></member></MetricDataResults></GetMetricDataResult></GetMetricDataResponse>';
    const m = parseMetricData(data);
    expect(m.get('m0_invocations')).toEqual([{ day: '2026-10-05', value: 12 }, { day: '2026-10-06', value: 3 }]);
    expect(m.get('m0_inputtokencount')).toEqual([{ day: '2026-10-06', value: 900 }]);
  });

  it('maps Azure Monitor totals per deployment and names the model', () => {
    const out = mapAzureMetrics(
      { id: '/subscriptions/s/resourceGroups/r/providers/Microsoft.CognitiveServices/accounts/acme-ai', name: 'acme-ai', kind: 'OpenAI', location: 'southafricanorth' },
      [{ name: 'gpt4o-prod', properties: { model: { name: 'gpt-4o', version: '2024-08-06' } } }],
      { value: [
        { name: { value: 'AzureOpenAIRequests' }, timeseries: [{ metadatavalues: [{ name: { value: 'modeldeploymentname' }, value: 'gpt4o-prod' }], data: [{ timeStamp: '2026-10-06T00:00:00Z', total: 40 }, { timeStamp: '2026-10-05T00:00:00Z', total: 0 }] }] },
        { name: { value: 'ProcessedPromptTokens' }, timeseries: [{ metadatavalues: [{ name: { value: 'modeldeploymentname' }, value: 'gpt4o-prod' }], data: [{ timeStamp: '2026-10-06T00:00:00Z', total: 5000 }] }] },
      ] },
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subject: 'acme-ai/gpt4o-prod', displayName: 'gpt-4o 2024-08-06', day: '2026-10-06', activity: 40 });
    expect(out[0].metrics).toMatchObject({ inputTokens: 5000, location: 'southafricanorth' });
  });

  it('maps Vertex AI invocations and tokens by model', () => {
    const out = mapVertex(
      [{ resource: { labels: { model_user_id: 'gemini-2.5-pro' } }, points: [{ interval: { endTime: '2026-10-06T00:00:00Z' }, value: { int64Value: '7' } }] }],
      [{ resource: { labels: { model_user_id: 'gemini-2.5-pro' } }, points: [{ interval: { endTime: '2026-10-06T00:00:00Z' }, value: { int64Value: '1200' } }] }],
      'acme-prod',
    );
    expect(out[0]).toMatchObject({ subject: 'gemini-2.5-pro (acme-prod)', activity: 7 });
    expect(out[0].metrics).toMatchObject({ tokens: 1200 });
  });
});

describe('Importing an export', () => {
  it('finds columns by name, whatever order they are in', () => {
    const csv = '﻿Name,Status,Email,Total messages,Last active\nAna Smith,Active,ANA@co.com,"1,204",2026-10-01\nBen,Active,ben@co.com,0,Never\nnot a person,,nope,3,\n';
    const r = parseUsageExport(csv, 'chatgpt_workspace', NOW);
    expect(r.columns).toMatchObject({ email: 'Email', name: 'Name', activity: 'Total messages', lastActive: 'Last active' });
    expect(r.records).toHaveLength(2);
    expect(r.records[0]).toMatchObject({ subject: 'ana@co.com', displayName: 'Ana Smith', activity: 1204, lastActiveAt: '2026-10-01T00:00:00Z', day: '2026-10-07' });
    expect(r.records[1].lastActiveAt).toBeNull();
    expect(r.problems[0]).toMatch(/1 row had no valid email/);
  });

  it('needs an email column', () => {
    expect(parseUsageExport('Name,Messages\nA,3\n', 'chatgpt_workspace').problems[0]).toMatch(/email column/);
  });

  it('reads only unambiguous day-first or month-first dates', () => {
    expect(exportDate('25/09/2026')).toBe('2026-09-25T00:00:00Z');
    expect(exportDate('09/25/2026')).toBe('2026-09-25T00:00:00Z');
    expect(exportDate('03/04/2026')).toBeNull();
    expect(exportDate('never')).toBeNull();
  });
});

describe('The register check', () => {
  it('passes a product a declared system names, and warns about one nothing covers', () => {
    const recs = [
      { product: 'm365_copilot' as const, subjectType: 'person' as const, subject: 'a@co.com', day: '2026-10-05', lastActiveAt: '2026-10-05T00:00:00Z', activity: 0 },
      { product: 'claude_code' as const, subjectType: 'person' as const, subject: 'b@co.com', day: '2026-10-06', activity: 4 },
      { product: 'claude_code' as const, subjectType: 'person' as const, subject: 'c@co.com', day: '2026-10-06', activity: 1 },
    ];
    const out = registerChecks(recs, ['microsoft 365 copilot for staff'], NOW);
    const copilot = out.find((c) => c.subject === 'Microsoft 365 Copilot')!;
    const code = out.find((c) => c.subject === 'Claude Code')!;
    expect(copilot.status).toBe('pass');
    expect(code.status).toBe('warn');
    expect(code.summary).toBe('2 people use Claude Code, and nothing on your AI register covers it.');
  });

  it('ignores seats nobody has used in the window', () => {
    const out = registerChecks([{ product: 'github_copilot', subjectType: 'person', subject: 'x', day: '2026-10-07', lastActiveAt: null, activity: 0 }], [], NOW);
    expect(out).toEqual([]);
  });

  it('matches declared names by the product’s own words', () => {
    expect(declaredFor('gemini_workspace', ['customer chatbot', 'gemini for staff'])).toBe('gemini for staff');
    expect(declaredFor('aws_bedrock', ['customer chatbot'])).toBeNull();
  });
});
