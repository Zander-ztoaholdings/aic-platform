import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, questionnaires, questionnaireItems, eq, desc, sql } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { gatherOrgFacts } from '@/lib/org-facts';
import { parseQuestions } from '@/lib/questionnaire';
import { draftQuestions } from '@/lib/ai/draft-questions';

export const dynamic = 'force-dynamic';

/** The organisation's questionnaires, newest first, with progress. */
export async function GET() {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const rows = await getTenantDb(c.orgId).query((tx) =>
    tx.select({
      id: questionnaires.id, title: questionnaires.title, requester: questionnaires.requester, createdAt: questionnaires.createdAt,
      total: sql<number>`(select count(*)::int from questionnaire_items i where i.questionnaire_id = ${questionnaires.id})`,
      approved: sql<number>`(select count(*)::int from questionnaire_items i where i.questionnaire_id = ${questionnaires.id} and i.status = 'approved')`,
      needsInput: sql<number>`(select count(*)::int from questionnaire_items i where i.questionnaire_id = ${questionnaires.id} and i.status = 'needs_input')`,
    }).from(questionnaires).where(eq(questionnaires.orgId, c.orgId)).orderBy(desc(questionnaires.createdAt))
  );
  return NextResponse.json({ questionnaires: rows });
}

/** Start a questionnaire from pasted questions; every question gets a draft from the record. */
export async function POST(request: NextRequest) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as { title?: unknown; requester?: unknown; text?: unknown };
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 255) : '';
  const requester = typeof b.requester === 'string' ? b.requester.trim().slice(0, 255) : '';
  const questions = typeof b.text === 'string' ? parseQuestions(b.text) : [];
  if (!title) return NextResponse.json({ error: 'Give the questionnaire a name, for example the customer it is for.' }, { status: 400 });
  if (questions.length === 0) return NextResponse.json({ error: 'Paste at least one question, one per line.' }, { status: 400 });

  const facts = await gatherOrgFacts(c.orgId);
  if (!facts) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

  const drafts = await draftQuestions(c.orgId, questions, facts);
  const id = await getTenantDb(c.orgId).query(async (tx) => {
    const [q] = await tx.insert(questionnaires).values({ orgId: c.orgId, title, requester: requester || null, createdBy: c.userId }).returning({ id: questionnaires.id });
    await tx.insert(questionnaireItems).values(questions.map((question, i) => {
      const d = drafts[i];
      return { questionnaireId: q.id, orgId: c.orgId, position: i + 1, question, draft: d.draft, topic: d.topic, sources: d.sources, status: d.status };
    }));
    return q.id;
  });
  return NextResponse.json({ id, count: questions.length }, { status: 201 });
}
