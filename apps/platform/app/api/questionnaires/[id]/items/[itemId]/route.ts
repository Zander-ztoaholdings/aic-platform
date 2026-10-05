import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, questionnaireItems, questionnaires, eq, and } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';
import { gatherOrgFacts } from '@/lib/org-facts';
import { draftQuestions } from '@/lib/ai/draft-questions';

/**
 * Work on one answer. action:
 *   save       keep the edited text as the working answer
 *   approve    the signed-in person approves the text as the organisation's answer
 *   reopen     withdraw an approval to edit again
 *   needs_input  mark it as needing someone's input
 *   redraft    rebuild the draft from the current record
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const { id, itemId } = await params;
  if (!isUuid(id) || !isUuid(itemId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; answer?: unknown };
  const action = b.action;
  const text = typeof b.answer === 'string' ? b.answer.trim().slice(0, 8000) : undefined;

  const db = getTenantDb(c.orgId);
  const [item] = await db.query((tx) => tx.select().from(questionnaireItems)
    .where(and(eq(questionnaireItems.id, itemId), eq(questionnaireItems.questionnaireId, id), eq(questionnaireItems.orgId, c.orgId))).limit(1));
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let set: Partial<typeof questionnaireItems.$inferInsert>;
  if (action === 'approve') {
    const final = text ?? item.answer ?? item.draft ?? '';
    if (!final) return NextResponse.json({ error: 'Write an answer before approving it.' }, { status: 400 });
    if (/CHECK BEFORE SENDING:|^ADD:|\nADD:/m.test(final)) {
      return NextResponse.json({ error: 'Remove the AIC notes ("CHECK BEFORE SENDING" or "ADD") from the answer before approving it.' }, { status: 400 });
    }
    set = { answer: final, status: 'approved', approvedBy: c.userId, approvedAt: new Date() };
  } else if (action === 'save') {
    if (text === undefined) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
    set = { answer: text, status: item.status === 'approved' ? 'draft' : item.status, approvedBy: null, approvedAt: null };
  } else if (action === 'reopen') {
    set = { status: 'draft', approvedBy: null, approvedAt: null };
  } else if (action === 'needs_input') {
    set = { status: 'needs_input', approvedBy: null, approvedAt: null };
  } else if (action === 'redraft') {
    const facts = await gatherOrgFacts(c.orgId);
    if (!facts) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    const [d] = await draftQuestions(c.orgId, [item.question], facts);
    set = { draft: d.draft, topic: d.topic, sources: d.sources, status: item.status === 'approved' ? 'approved' : d.status };
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  await db.query(async (tx) => {
    await tx.update(questionnaireItems).set({ ...set, updatedAt: new Date() }).where(eq(questionnaireItems.id, itemId));
    await tx.update(questionnaires).set({ updatedAt: new Date() }).where(eq(questionnaires.id, id));
  });
  return NextResponse.json({ ok: true });
}
