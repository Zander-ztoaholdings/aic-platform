import { describe, it, expect } from 'vitest';
import { renderEmail } from '../../lib/email';
import { appUrl } from '../../lib/app-url';

describe('renderEmail', () => {
  it('escapes content and carries the link in both parts', () => {
    const { html, text } = renderEmail({
      to: 'a@b.co',
      subject: 's',
      paragraphs: ['Hello <script>alert(1)</script>'],
      action: { label: 'Accept', url: 'https://app.aiccertified.cloud/invite?token=abc&x=1' },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('token=abc&amp;x=1');
    expect(text).toContain('https://app.aiccertified.cloud/invite?token=abc&x=1');
  });
});

describe('appUrl', () => {
  it('never sends a production link to localhost', () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = { a: env.AUTH_URL, n: env.NEXTAUTH_URL, e: env.NODE_ENV };
    delete env.AUTH_URL;
    env.NEXTAUTH_URL = 'http://localhost:3001';
    env.NODE_ENV = 'production';
    expect(appUrl()).toBe('https://app.aiccertified.cloud');
    env.NODE_ENV = 'development';
    expect(appUrl()).toBe('http://localhost:3001');
    for (const [k, v] of [['AUTH_URL', saved.a], ['NEXTAUTH_URL', saved.n], ['NODE_ENV', saved.e]] as const) {
      if (v === undefined) delete env[k]; else env[k] = v;
    }
  });
});
