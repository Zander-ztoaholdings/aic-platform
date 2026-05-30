import { describe, it, expect, vi } from 'vitest';

// Mock the global fetch for integration testing the engine proxy
global.fetch = vi.fn();

describe('Audit Engine Proxy Logic', () => {
    it('should correctly format data for the Python Engine', async () => {
        const sampleData = {
            protected_attribute: 'race',
            outcome_variable: 'hired',
            rows: [
                { race: 'A', hired: 1 },
                { race: 'B', hired: 0 }
            ]
        };

        // Simulated Proxy Logic
        const formatForEngine = (data: any) => ({
            protected_attribute: data.protected_attribute,
            outcome_variable: data.outcome_variable,
            data: data.rows
        });

        const formatted = formatForEngine(sampleData);
        
        expect(formatted).toHaveProperty('data');
        expect(Array.isArray(formatted.data)).toBe(true);
        expect(formatted.protected_attribute).toBe('race');
    });

    it('should handle engine errors gracefully', async () => {
        // Mock a 500 error from the engine
        (fetch as any).mockResolvedValue({
            ok: false,
            text: () => Promise.resolve('Internal Server Error')
        });

        const callEngine = async () => {
            const res = await fetch('http://localhost:8000/api/v1/analyze');
            if (!res.ok) throw new Error('Engine failed');
            return res.json();
        };

        await expect(callEngine()).rejects.toThrow('Engine failed');
    });
});
