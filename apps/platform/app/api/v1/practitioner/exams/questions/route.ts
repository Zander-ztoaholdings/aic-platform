import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, examQuestions, EncryptionService, eq } from '@aic/db';
import { auth } from '@aic/auth';
import { z } from 'zod';

const QuestionSchema = z.object({
  certLevelId: z.string().uuid(),
  question: z.string().min(10),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).default(1),
});

// GET /api/v1/practitioner/exams/questions - List questions (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: ISO 17024 Item Bank access restricted' }, { status: 403 });
    }

    const db = getSystemDb();
    const { searchParams } = new URL(request.url);
    const certLevelId = searchParams.get('certLevelId');

    let query = db.select().from(examQuestions);
    if (certLevelId) {
      query = db.select().from(examQuestions).where(eq(examQuestions.certLevelId, certLevelId)) as any;
    }

    const results = await query;

    // Decrypt for admin view
    const decrypted = results.map(q => ({
      ...q,
      question: EncryptionService.decrypt(q.questionEncrypted),
      options: JSON.parse(EncryptionService.decrypt(q.optionsEncrypted as string)),
      correctAnswer: EncryptionService.decrypt(q.correctAnswerEncrypted),
      explanation: q.explanationEncrypted ? EncryptionService.decrypt(q.explanationEncrypted) : null,
    }));

    return NextResponse.json(decrypted);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch item bank' }, { status: 500 });
  }
}

// POST /api/v1/practitioner/exams/questions - Add to Item Bank
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = QuestionSchema.parse(body);

    const db = getSystemDb();

    // [SECURITY] Encrypt sensitive ISO 17024 content
    const [newQuestion] = await db.insert(examQuestions).values({
      certLevelId: data.certLevelId,
      questionEncrypted: EncryptionService.encrypt(data.question),
      optionsEncrypted: EncryptionService.encrypt(JSON.stringify(data.options)),
      correctAnswerEncrypted: EncryptionService.encrypt(data.correctAnswer),
      explanationEncrypted: data.explanation ? EncryptionService.encrypt(data.explanation) : null,
      category: data.category,
      difficulty: data.difficulty,
      isActive: true
    }).returning();

    return NextResponse.json({ success: true, id: newQuestion.id }, { status: 201 });
  } catch (error) {
    console.error('[ITEM_BANK_ERROR]', error);
    return NextResponse.json({ error: 'Failed to secure question in item bank' }, { status: 400 });
  }
}
