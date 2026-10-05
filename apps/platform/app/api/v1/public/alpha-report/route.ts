import { NextResponse } from 'next/server';

/**
 * Withdrawn. This served a PDF report built from hard-coded demo values
 * ("Example Organisation", integrity score 92) under AIC's name. A report
 * from AIC is generated from an organisation's own record, at /api/reports.
 */
export async function GET() {
  return NextResponse.json({ error: 'This sample report has been withdrawn.' }, { status: 410 });
}
