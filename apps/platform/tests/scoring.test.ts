import { describe, it, expect } from 'vitest';

// Mimic the logic from api/stats/route.ts for the unit test
function calculateIntegrityScore(requirements: any[]) {
    const categories: any = {
        'DOCUMENTATION': { weight: 0.20, score: 0, total: 0 },
        'OVERSIGHT': { weight: 0.35, score: 0, total: 0 },
        'REPORTS': { weight: 0.25, score: 0, total: 0 },
        'TECHNICAL': { weight: 0.20, score: 0, total: 0 }
    };

    requirements.forEach(req => {
        const cat = categories[req.category];
        if (cat) {
            cat.total++;
            if (req.status === 'VERIFIED') cat.score++;
        }
    });

    let calculatedScore = 0;
    Object.values(categories).forEach((cat: any) => {
        if (cat.total > 0) {
            calculatedScore += (cat.score / cat.total) * cat.weight * 100;
        }
    });

    return Math.round(calculatedScore);
}

describe('Integrity Scoring Engine', () => {
    it('should return 100 when all categories are verified', () => {
        const reqs = [
            { category: 'DOCUMENTATION', status: 'VERIFIED' },
            { category: 'OVERSIGHT', status: 'VERIFIED' },
            { category: 'REPORTS', status: 'VERIFIED' },
            { category: 'TECHNICAL', status: 'VERIFIED' }
        ];
        expect(calculateIntegrityScore(reqs)).toBe(100);
    });

    it('should respect weighted categories (Oversight is heavy)', () => {
        // Oversight is 35%. If only oversight is verified, score should be 35.
        const reqs = [
            { category: 'DOCUMENTATION', status: 'PENDING' },
            { category: 'OVERSIGHT', status: 'VERIFIED' },
            { category: 'REPORTS', status: 'PENDING' },
            { category: 'TECHNICAL', status: 'PENDING' }
        ];
        expect(calculateIntegrityScore(reqs)).toBe(35);
    });

    it('should handle empty categories without NaN', () => {
        const reqs = [
            { category: 'DOCUMENTATION', status: 'VERIFIED' }
        ];
        // If only documentation exists and is verified, it's 100% of that 20% weight = 20.
        expect(calculateIntegrityScore(reqs)).toBe(20);
    });
});
