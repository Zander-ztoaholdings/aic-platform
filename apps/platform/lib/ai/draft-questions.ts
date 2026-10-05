import { draftAnswer, type Draft } from '../questionnaire';
import type { OrgFacts } from '../org-facts';
import { computeControls } from '../controls-data';
import { aiConfigured, pool } from './claude';
import { aiDraftAnswer, recordFacts, AI_QUESTION_CAP } from './questionnaire-ai';

/**
 * Drafts every question: the rules first, then the model for the questions
 * the rules could not place, when AIC's model account is configured.
 */
export async function draftQuestions(orgId: string, questions: string[], facts: OrgFacts): Promise<Draft[]> {
  const drafts = questions.map((q) => draftAnswer(q, facts));
  const open = drafts.map((d, i) => (d.topic === 'other' ? i : -1)).filter((i) => i >= 0).slice(0, AI_QUESTION_CAP);
  if (!aiConfigured() || open.length === 0) return drafts;
  const { common } = await computeControls(orgId);
  const record = recordFacts(facts, common.map((c) => ({ key: c.key, title: c.title, status: c.status, documents: c.documents })));
  const ai = await pool(open, 4, (i) => aiDraftAnswer(questions[i], record));
  open.forEach((i, n) => { if (ai[n]) drafts[i] = ai[n]!; });
  return drafts;
}
