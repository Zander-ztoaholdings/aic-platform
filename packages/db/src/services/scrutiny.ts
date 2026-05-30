/**
 * NLP EMPATHY SCRUTINY ENGINE
 * 
 * Evaluates the quality of human rationale in governance logs.
 * Checks for substantive context, ethical density, and qualitative depth.
 */

export interface ScrutinyResult {
  score: number; // 0-100
  status: 'SUBSTANTIVE' | 'BOX_CHECKING' | 'REJECTED';
  rationale: string;
}

export class EmpathyScrutiny {
  /**
   * Analyzes text for governance quality
   */
  static analyze(text: string): ScrutinyResult {
    if (!text || text.length < 10) {
      return {
        score: 0,
        status: 'REJECTED',
        rationale: 'Text too sparse for accountability validation.'
      };
    }

    const wordCount = text.split(/\s+/).length;
    
    // 1. Density Check (Quantity as a proxy for depth)
    let score = Math.min(wordCount * 2, 50);

    // 2. Keyword Scrutiny (Ethical Density)
    const indicators = [
      'stakeholder', 'impact', 'mitigation', 'bias', 'fairness', 
      'transparency', 'accountability', 'agency', 'human', 'oversight',
      'ethical', 'risk', 'safeguard', 'verified', 'rationale'
    ];

    const matchingIndicators = indicators.filter(word => 
      text.toLowerCase().includes(word)
    );

    score += (matchingIndicators.length / indicators.length) * 50;

    // 3. Status Determination
    let status: ScrutinyResult['status'] = 'BOX_CHECKING';
    if (score > 70) status = 'SUBSTANTIVE';
    if (score < 20) status = 'REJECTED';

    return {
      score: Math.round(score),
      status,
      rationale: status === 'SUBSTANTIVE' 
        ? 'High ethical density detected.' 
        : 'Rationale lacks qualitative depth. Tagged for human review.'
    };
  }
}
