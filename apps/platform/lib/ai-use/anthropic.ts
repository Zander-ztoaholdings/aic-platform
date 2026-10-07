/**
 * Anthropic, beyond API spend:
 *
 *   Claude Code, with the same Admin key the organisation already gave for
 *   usage (Console → Settings → Admin keys). One request per day, one row per
 *   person per day.
 *   Docs: https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api
 *
 *   Claude Enterprise seats (chat, projects, Claude Code, Cowork), with a
 *   separate Analytics key that only the organisation's Primary Owner can
 *   create (claude.ai → Organization settings → API, scope read:analytics).
 *   Enterprise plans only; data is about a day behind and starts 2026-01-01.
 *   Docs: https://platform.claude.com/docs/en/manage-claude/analytics-api
 *
 * Neither reads a prompt, a conversation or a file. Both report counts.
 */
import { AI_PRODUCTS, isoDay, type AiUseOutput, type AiUseRecord } from './products';

const BASE = () => (process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const DAY = 86_400_000;

export class AnthropicUseError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Page<T> = { data?: T[]; has_more?: boolean; next_page?: string | null; next_cursor?: string | null };

async function pages<T>(path: string, key: string, params: Record<string, string>, max = 20): Promise<T[]> {
  const out: T[] = [];
  let page: string | null = null;
  for (let i = 0; i < max; i++) {
    const qs = new URLSearchParams(params);
    if (page) qs.set('page', page);
    const res = await fetch(`${BASE()}${path}?${qs}`, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AnthropicUseError(res.status, `Anthropic returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const body = (await res.json()) as Page<T>;
    out.push(...(body.data ?? []));
    // The reference pages use next_page; one extract showed next_cursor. Either ends the loop when absent.
    page = body.next_page ?? body.next_cursor ?? null;
    if (!page) break;
  }
  return out;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/** The days to read, oldest first, ending yesterday (today is never complete). */
export function daysBack(days: number, now = new Date()): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY;
  return Array.from({ length: days }, (_, i) => isoDay(new Date(end - (days - 1 - i) * DAY)));
}

// ── Claude Code ─────────────────────────────────────────────────────────────

type CodeRow = {
  date?: string;
  actor?: { type?: string; email_address?: string; api_key_name?: string };
  terminal_type?: string;
  core_metrics?: { num_sessions?: number; lines_of_code?: { added?: number; removed?: number }; commits_by_claude_code?: number; pull_requests_by_claude_code?: number };
  tool_actions?: Record<string, { accepted?: number; rejected?: number }>;
  model_breakdown?: { model?: string; tokens?: { input?: number; output?: number; cache_read?: number; cache_creation?: number } }[];
};

export function mapClaudeCode(rows: CodeRow[], fallbackDay: string): AiUseRecord[] {
  const byPerson = new Map<string, AiUseRecord>();
  for (const r of rows) {
    const who = r.actor?.email_address?.toLowerCase() ?? (r.actor?.api_key_name ? `API key: ${r.actor.api_key_name}` : null);
    if (!who) continue;
    const day = (r.date ?? fallbackDay).slice(0, 10);
    const k = `${who}|${day}`;
    // The report can split one person's day by terminal; those are added together.
    const rec = byPerson.get(k) ?? {
      product: 'claude_code' as const, subjectType: 'person' as const, subject: who, day, activity: 0,
      lastActiveAt: `${day}T00:00:00Z`,
      metrics: { linesAdded: 0, linesRemoved: 0, commits: 0, pullRequests: 0, accepted: 0, rejected: 0, tokens: 0 },
    };
    const m = rec.metrics as Record<string, number>;
    rec.activity += n(r.core_metrics?.num_sessions);
    m.linesAdded += n(r.core_metrics?.lines_of_code?.added);
    m.linesRemoved += n(r.core_metrics?.lines_of_code?.removed);
    m.commits += n(r.core_metrics?.commits_by_claude_code);
    m.pullRequests += n(r.core_metrics?.pull_requests_by_claude_code);
    for (const t of Object.values(r.tool_actions ?? {})) { m.accepted += n(t?.accepted); m.rejected += n(t?.rejected); }
    for (const b of r.model_breakdown ?? []) {
      const t = b.tokens ?? {};
      m.tokens += n(t.input) + n(t.output) + n(t.cache_read) + n(t.cache_creation);
    }
    byPerson.set(k, rec);
  }
  return [...byPerson.values()];
}

export async function pullClaudeCode(adminKey: string, days: number, now = new Date()): Promise<AiUseOutput> {
  const records: AiUseRecord[] = [];
  const notes: string[] = [];
  for (const day of daysBack(days, now)) {
    try {
      const rows = await pages<CodeRow>('/v1/organizations/usage_report/claude_code', adminKey, { starting_at: day, limit: '1000' });
      records.push(...mapClaudeCode(rows, day));
    } catch (e) {
      // A key that cannot read this report still reads API usage; say so once and stop.
      if (e instanceof AnthropicUseError && (e.status === 403 || e.status === 404)) {
        notes.push(`${AI_PRODUCTS.claude_code.name}: this Admin key cannot read the Claude Code report (${e.status}).`);
        break;
      }
      throw e;
    }
  }
  return { records, notes };
}

// ── Claude Enterprise ───────────────────────────────────────────────────────

type SeatRow = {
  user?: { id?: string; email_address?: string; name?: string };
  last_activity_date?: string | null;
  chat_metrics?: Record<string, number | undefined>;
  claude_code_metrics?: { core_metrics?: { distinct_session_count?: number; commit_count?: number; pull_request_count?: number; lines_of_code?: { added_count?: number; removed_count?: number } } };
  cowork_metrics?: { message_count?: number; distinct_session_count?: number };
};

type Summary = {
  starting_at?: string;
  assigned_seat_count?: number;
  pending_invite_count?: number;
  daily_active_user_count?: number;
  weekly_active_user_count?: number;
  monthly_active_user_count?: number;
};

export function mapClaudeSeats(rows: SeatRow[], day: string): AiUseRecord[] {
  const out: AiUseRecord[] = [];
  for (const r of rows) {
    const email = r.user?.email_address?.toLowerCase();
    if (!email) continue;
    const chat = r.chat_metrics ?? {};
    const code = r.claude_code_metrics?.core_metrics ?? {};
    const cowork = r.cowork_metrics ?? {};
    const messages = n(chat.message_count);
    const coworkMessages = n(cowork.message_count);
    const codeSessions = n(code.distinct_session_count);
    // Blocks are always present and zero when unused; a row of zeros is not use.
    if (messages + coworkMessages + codeSessions === 0) continue;
    out.push({
      product: 'claude_seats', subjectType: 'person', subject: email, displayName: r.user?.name ?? null, day,
      lastActiveAt: r.last_activity_date ? `${r.last_activity_date.slice(0, 10)}T00:00:00Z` : `${day}T00:00:00Z`,
      activity: messages + coworkMessages,
      metrics: {
        conversations: n(chat.distinct_conversation_count), projects: n(chat.distinct_projects_used_count),
        connectors: n(chat.distinct_connectors_used_count), files: n(chat.distinct_files_uploaded_count),
        coworkMessages, codeSessions, commits: n(code.commit_count),
      },
    });
  }
  return out;
}

export async function pullClaudeSeats(analyticsKey: string, days: number, now = new Date()): Promise<AiUseOutput> {
  const records: AiUseRecord[] = [];
  const notes: string[] = [];
  // Data starts on 1 January 2026 and is about a day behind.
  const wanted = daysBack(days, now).filter((d) => d >= '2026-01-01');
  for (const day of wanted.reverse()) {
    try {
      const rows = await pages<SeatRow>('/v1/organizations/analytics/users', analyticsKey, { date: day, limit: '1000' });
      records.push(...mapClaudeSeats(rows, day));
    } catch (e) {
      if (!(e instanceof AnthropicUseError)) throw e;
      if (e.status === 401 || e.status === 403) throw e;
      // 400 names the latest day that is ready; the most recent days may not be.
      if (e.status === 400) continue;
      throw e;
    }
  }
  let facts: AiUseOutput['facts'];
  try {
    const sums = await pages<Summary>('/v1/organizations/analytics/summaries', analyticsKey, { starting_date: wanted[wanted.length - 1] ?? isoDay(now) }, 2);
    const last = sums.filter((s) => typeof s.assigned_seat_count === 'number').pop();
    if (last) facts = { assignedSeats: n(last.assigned_seat_count), pendingInvites: n(last.pending_invite_count), monthlyActive: n(last.monthly_active_user_count) };
  } catch (e) {
    if (e instanceof AnthropicUseError && (e.status === 401 || e.status === 403)) throw e;
    notes.push('Claude Enterprise: seat totals could not be read this time.');
  }
  return { records, notes, facts };
}

/** Analytics keys and Admin keys are not interchangeable. */
export function analyticsKeyProblem(key: string): string | null {
  const k = key.trim();
  if (!k) return 'Paste the Analytics API key.';
  if (k.startsWith('sk-ant-admin')) return 'That is an Admin key. Claude Enterprise analytics needs an Analytics API key, created by the Primary Owner in claude.ai → Organization settings → API.';
  return null;
}
