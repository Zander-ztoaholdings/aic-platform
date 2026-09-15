import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { EmpathyScrutiny } from '@aic/db';

/**
 * Backs app/empathy ("Empathy Scrutiny Engine (B0-2)").
 *
 * This is NOT an LLM call - there is no model in the loop, no API key, no
 * per-request cost. It reuses EmpathyScrutiny (packages/db/src/services/
 * scrutiny.ts), the same deterministic keyword/density heuristic already
 * used elsewhere to grade the substantiveness of a governance rationale.
 * That engine's vocabulary (SUBSTANTIVE / BOX_CHECKING / REJECTED, a 0-100
 * score) is repurposed here as a proxy for dignified, specific language in
 * a client-facing communication, which is a reasonable but genuinely
 * different question than the one it was written to answer. Treat this as
 * a working placeholder, not calibrated dignity/tone analysis - a real
 * version of this page would want an actual NLP/LLM pass, which is a
 * product and cost decision, not an engineering one, and is flagged
 * separately rather than decided here.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const result = EmpathyScrutiny.analyze(text);

    const violations: string[] = [];
    if (result.status === 'REJECTED') {
      violations.push('Message is too sparse to evaluate for dignity or clarity of recourse.');
    } else if (result.status === 'BOX_CHECKING') {
      violations.push('Reads as generic/formulaic rather than specific to this person\'s situation.');
      violations.push('Limited evidence of stakeholder-impact or fairness language.');
    }

    const suggestion =
      result.status === 'SUBSTANTIVE'
        ? 'Language shows adequate specificity and dignity markers. No changes required.'
        : result.status === 'BOX_CHECKING'
          ? 'Add specific, human language: what was considered, why this outcome, and what recourse exists.'
          : 'Rewrite with enough detail that the recipient understands the decision and their options.';

    return NextResponse.json({
      score: result.score / 100,
      status: result.status,
      violations,
      suggestion,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }
}
