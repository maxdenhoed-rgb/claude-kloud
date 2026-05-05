import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const WEBHOOK_SECRET = 'internal-test-secret-32chars!!!!!';

function setupEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('PORT', '8080');
  vi.stubEnv('LOG_LEVEL', 'fatal');
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('ANTHROPIC_API_URL', 'http://localhost:9999');
  vi.stubEnv('ALLOWED_MODELS', 'claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5');
  vi.stubEnv('DATABASE_URL', 'postgresql://test');
  vi.stubEnv('SESSION_SIGNING_SECRET', 'test-signing-secret-at-least-32-chars-long!!');
  vi.stubEnv('INTERNAL_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.stubEnv('GIT_SHA', 'test');
  vi.stubEnv('APP_VERSION', '0.0.0');
  vi.resetModules();
}

async function buildApp() {
  const { loadEnv } = await import('../lib/env.js');
  loadEnv();
  const { internalAuth } = await import('./internalAuth.js');
  const app = new Hono();
  app.post('/internal/sessions', internalAuth, (c) => c.json({ ok: true, data: {} }, 201));
  return app;
}

describe('internalAuth middleware — timing-safe compare', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('allows the request when the correct secret is supplied', async () => {
    const app = await buildApp();
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        'x-webhook-secret': WEBHOOK_SECRET,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('rejects the request when the secret value is wrong', async () => {
    const app = await buildApp();
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        'x-webhook-secret': 'wrong-value-that-has-same-length!!!',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects the request when the secret has the wrong length (shorter)', async () => {
    const app = await buildApp();
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        'x-webhook-secret': 'too-short',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects the request when the secret has the wrong length (longer)', async () => {
    const app = await buildApp();
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        'x-webhook-secret': WEBHOOK_SECRET + '-extra-chars',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects the request when the header is absent', async () => {
    const app = await buildApp();
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
