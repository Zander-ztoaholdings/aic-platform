import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, questionnaires, questionnaireItems, users, eq, and, asc } from '@aic/db';
import { policyCaller } from '@/lib/policies';
import { isUuid } from '@/lib/policy-hash';
import { toCsv } from '@/lib/questionnaire';

/** CSV of the questionnaire. Only approved answers are included as answers. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await policyCaller();
  if ('error' in c) return c.error;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = await getTenantDb(c.orgId).query(async (tx) => {
    const [q] = await tx.select().from(questionnaires).where(and(eq(questionnaires.id, id), eq(questionnaires.orgId, c.orgId))).limit(1);
    if (!q) return null;
    const items = await tx.select({ question: questionnaireItems.question, answer: questionnaireItems.answer, status: questionnaireItems.status, approvedAt: questionnaireItems.approvedAt, approvedBy: users.name })
      .from(questionnaireItems).leftJoin(users, eq(users.id, questionnaireItems.approvedBy))
      .where(eq(questionnaireItems.questionnaireId, id)).orderBy(asc(questionnaireItems.position));
    return { q, items };
  });
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const csv = toCsv(res.items.map((i) => ({ ...i, approvedAt: i.approvedAt ? new Date(i.approvedAt).toISOString() : null })));
  const name = res.q.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'questionnaire';
  return new NextResponse('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` },
  });
}
