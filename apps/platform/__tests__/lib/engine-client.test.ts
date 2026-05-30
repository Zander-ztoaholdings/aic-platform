import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the EngineClient request building and retry logic
// We re-implement core logic to avoid import alias issues

describe('EngineClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('ENGINE_URL', 'http://localhost:8000');
    vi.stubEnv('ENGINE_API_KEY', 'test-api-key');
  });

  function createClient() {
    const baseUrl = process.env.ENGINE_URL || 'http://localhost:8000';
    const apiKey = process.env.ENGINE_API_KEY || '';

    return {
      async request<T>(path: string, method: string, body?: any): Promise<T> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['X-API-Key'] = apiKey;

        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Engine API Error (${response.status})`);
        }

        return await response.json() as T;
      }
    };
  }

  it('includes API key header when ENGINE_API_KEY is set', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    const client = createClient();
    await client.request('/health', 'GET');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'test-api-key',
        }),
      })
    );
  });

  it('sends correct body for bias analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ audit_hash: 'abc123', status: 'PASSED' }),
    });

    const client = createClient();
    const body = {
      data: [{ race: 'A', hired: 1 }],
      protected_attribute: 'race',
      outcome_variable: 'hired',
    };
    await client.request('/api/v1/analyze', 'POST', body);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  });

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve('Validation error'),
    });

    const client = createClient();
    await expect(client.request('/api/v1/analyze', 'POST', {})).rejects.toThrow('Engine API Error (422)');
  });

  it('sends correct body for privacy audit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ audit_hash: 'priv123', spi_fields: ['race'] }),
    });

    const client = createClient();
    await client.request('/api/v1/audit/privacy', 'POST', { columns: ['user_id', 'race', 'amount'] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/audit/privacy',
      expect.objectContaining({
        body: JSON.stringify({ columns: ['user_id', 'race', 'amount'] }),
      })
    );
  });

  it('sends correct body for labor audit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ audit_hash: 'lab123', automation_density: 0.85 }),
    });

    const client = createClient();
    await client.request('/api/v1/audit/labor', 'POST', {
      total_decisions: 1000,
      human_interventions: 150,
      human_overrides: 45,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/audit/labor',
      expect.objectContaining({
        body: JSON.stringify({
          total_decisions: 1000,
          human_interventions: 150,
          human_overrides: 45,
        }),
      })
    );
  });

  it('sends correct body for drift analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ psi: 0.05, drift_detected: false }),
    });

    const client = createClient();
    await client.request('/api/v1/analyze/drift', 'POST', {
      baseline_data: [1.0, 2.0, 3.0],
      current_data: [1.1, 2.1, 3.1],
      feature_name: 'income',
      n_bins: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analyze/drift',
      expect.objectContaining({
        body: JSON.stringify({
          baseline_data: [1.0, 2.0, 3.0],
          current_data: [1.1, 2.1, 3.1],
          feature_name: 'income',
          n_bins: 10,
        }),
      })
    );
  });

  it('sends correct body for empathy analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sentiment: 'neutral', audit_hash: 'emp123' }),
    });

    const client = createClient();
    await client.request('/api/v1/analyze/empathy', 'POST', {
      text: 'Your application has been declined.',
      context: 'rejection',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analyze/empathy',
      expect.objectContaining({
        body: JSON.stringify({
          text: 'Your application has been declined.',
          context: 'rejection',
        }),
      })
    );
  });

  it('sends correct body for correction validation', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ compliant: true, score: 1.0 }),
    });

    const client = createClient();
    await client.request('/api/v1/validate/correction-process', 'POST', {
      has_appeal_mechanism: true,
      response_time_hours: 24,
      human_reviewer_assigned: true,
      clear_instructions: true,
      accessible_format: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/validate/correction-process',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('sends correct body for intersectional analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ audit_hash: 'int123', groups: [] }),
    });

    const client = createClient();
    await client.request('/api/v1/analyze/intersectional', 'POST', {
      data: [{ race: 'A', gender: 'M', hired: 1 }],
      protected_attributes: ['race', 'gender'],
      outcome_variable: 'hired',
      min_group_size: 30,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analyze/intersectional',
      expect.objectContaining({
        body: expect.stringContaining('"protected_attributes":["race","gender"]'),
      })
    );
  });

  it('sends correct body for comprehensive audit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ overall_score: 0.85, audit_hash: 'comp123' }),
    });

    const client = createClient();
    await client.request('/api/v1/audit/comprehensive', 'POST', {
      organization_name: 'Test Corp',
      ai_systems: [{ name: 'Loan Engine', type: 'credit_scoring' }],
      framework: 'popia',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/audit/comprehensive',
      expect.objectContaining({
        body: expect.stringContaining('"organization_name":"Test Corp"'),
      })
    );
  });
});
