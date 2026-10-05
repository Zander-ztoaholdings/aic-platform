import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, questionnaires, questionnaireItems, users, eq, and, asc } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';

export const dynamic = 'force-dynamic';

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = await getTenantDb(c.orgId).query(async (tx) => {
    const [q] = await tx.select().from(questionnaires).where(and(eq(questionnaires.id, id), eq(questionnaires.orgId, c.orgId))).limit(1);
    if (!q) return null;
    const items = await tx.select({
      id: questionnaireItems.id, position: questionnaireItems.position, question: questionnaireItems.question, draft: questionnaireItems.draft,
      answer: questionnaireItems.answer, topic: questionnaireItems.topic, sources: questionnaireItems.sources, status: questionnaireItems.status,
      approvedAt: questionnaireItems.approvedAt, approvedBy: users.name,
    }).from(questionnaireItems).leftJoin(users, eq(users.id, questionnaireItems.approvedBy))
      .where(eq(questionnaireItems.questionnaireId, id)).orderBy(asc(questionnaireItems.position));
    return { questionnaire: q, items };
  });
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...res, canManage: c.canManage });
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller({ manage: true });
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await getTenantDb(c.orgId).query((tx) => tx.delete(questionnaires).where(and(eq(questionnaires.id, id), eq(questionnaires.orgId, c.orgId))));
  return NextResponse.json({ ok: true });
}
