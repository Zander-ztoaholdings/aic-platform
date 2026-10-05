import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, trainingCompletions } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { MODULE_BY_KEY, scoreQuiz } from '@/lib/training/modules';

/** One module to read and take. The answers are not sent to the browser. */
export async function GET(_r: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  const m = MODULE_BY_KEY[key];
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...m, quiz: m.quiz.map(({ q, options }) => ({ q, options })) });
}

/** Submit answers. A pass is recorded with the score. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  const m = MODULE_BY_KEY[key];
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as { answers?: unknown };
  const r = scoreQuiz(m, b.answers);
  // On a pass, show the right answers and why. On a fail, only which ones were wrong, so a retake still tests something.
  const feedback = m.quiz.map((q, i) => {
    const correct = Array.isArray(b.answers) && b.answers[i] === q.answer;
    return r.passed ? { correct, answer: q.answer, why: q.why } : { correct };
  });
  if (r.passed) {
    const saved = await guarded('016', async () => {
      await getTenantDb(c.orgId).query((tx) => tx.insert(trainingCompletions).values({ orgId: c.orgId, userId: c.userId, moduleKey: m.key, moduleVersion: m.version, score: r.score }));
      return null;
    });
    if (saved) return saved;
  }
  return NextResponse.json({ ...r, feedback });
}
