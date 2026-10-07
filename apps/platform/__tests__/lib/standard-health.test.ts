// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('standard health explains an unreachable website', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); });

  it('says when the internal address is not set', async () => {
    vi.stubEnv('AIC_WEB_INTERNAL_URL', '');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    const { standardHealth } = await import('@/lib/standard');
    const h = await standardHealth();
    expect(h.ok).toBe(false);
    expect(h.detail).toContain('AIC_WEB_INTERNAL_URL is not set');
  });

  it('names the network error when the internal address fails', async () => {
    vi.stubEnv('AIC_WEB_INTERNAL_URL', 'http://aic-web:3000');
    const err = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    const { standardHealth } = await import('@/lib/standard');
    const h = await standardHealth();
    expect(h.detail).toContain('the internal address failed (fetch failed: ENOTFOUND)');
    expect(h.detail).not.toContain('aic-web:3000');
  });
});
