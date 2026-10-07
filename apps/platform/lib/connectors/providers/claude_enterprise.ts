/**
 * Claude Enterprise, read with an Analytics API key (read:analytics) that only
 * the organisation's Primary Owner can create. Counts only: no prompt,
 * conversation or file is reachable with this key.
 * Docs: https://platform.claude.com/docs/en/manage-claude/analytics-api
 */
import { need } from '../http';
import { ConnectorError, type ConnectorImpl } from '../types';
import { pullClaudeSeats, analyticsKeyProblem, AnthropicUseError } from '../../ai-use/anthropic';

function keyOf(c: Record<string, string>): string {
  const key = need(c, 'analyticsKey', 'The Analytics API key').trim();
  const problem = analyticsKeyProblem(key);
  if (problem) throw new ConnectorError(400, problem);
  return key;
}

async function seats(key: string, days: number, now: Date) {
  try {
    return await pullClaudeSeats(key, days, now);
  } catch (e) {
    if (e instanceof AnthropicUseError) {
      if (e.status === 401) throw new ConnectorError(401, 'Anthropic did not accept the Analytics API key.');
      if (e.status === 403) throw new ConnectorError(403, 'This key cannot read analytics. It needs the read:analytics scope, and the organisation must be on Claude Enterprise.');
      throw new ConnectorError(e.status, e.message);
    }
    throw e;
  }
}

export const claudeEnterprise: ConnectorImpl = {
  async run(c, ctx) {
    // Reading yesterday proves the key; the readings themselves are taken by aiUse.
    const out = await seats(keyOf(c), 2, ctx.now);
    const seatsLabel = typeof out.facts?.assignedSeats === 'number' ? `Claude Enterprise, ${out.facts.assignedSeats} seats` : 'Claude Enterprise';
    return { results: [], label: seatsLabel };
  },
  async aiUse(c, ctx, days) {
    return seats(keyOf(c), days, ctx.now);
  },
};
