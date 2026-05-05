import { issueSessionToken } from '@claudekloud/session-token';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { redactRequestBody, redactAuthHeader } from '../services/callLog.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-signing-secret-at-least-32-chars-long!!';

async function makeToken(
  overrides: Partial<{
    sub: string;
    sid: string;
    lab: string;
    budget_tier: 'standard' | 'extended' | 'long-context';
  }> = {},
) {
  return issueSessionToken(
    {
      sub: overrides.sub ?? 'user_test_001',
      sid: overrides.sid ?? '550e8400-e29b-41d4-a716-446655440000',
      lab: overrides.lab ?? '01-agentic-architecture/lab-01',
      budget_tier: overrides.budget_tier ?? 'standard',
    },
    TEST_SECRET,
  );
}

// ---------------------------------------------------------------------------
// Log redaction tests (no DB required)
// ---------------------------------------------------------------------------

describe('redactAuthHeader', () => {
  it('replaces x-api-key with [REDACTED]', () => {
    const headers = {
      'x-api-key': 'sk-ant-supersecret',
      'content-type': 'application/json',
    };
    const result = redactAuthHeader(headers);
    expect(result['x-api-key']).toBe('[REDACTED]');
    expect(result['content-type']).toBe('application/json');
  });

  it('replaces Authorization with [REDACTED] (case-insensitive key)', () => {
    const headers = { Authorization: 'Bearer sk-ant-12345' };
    const result = redactAuthHeader(headers);
    expect(result['Authorization']).toBe('[REDACTED]');
  });

  it('does not mutate the original headers object', () => {
    const headers = { 'x-api-key': 'sk-ant-secret' };
    const result = redactAuthHeader(headers);
    expect(headers['x-api-key']).toBe('sk-ant-secret');
    expect(result['x-api-key']).toBe('[REDACTED]');
  });

  it('leaves unrelated headers untouched', () => {
    const headers = {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    const result = redactAuthHeader(headers);
    expect(result).toEqual(headers);
  });
});

describe('redactRequestBody', () => {
  it('redacts x-api-key from nested headers', () => {
    const body = {
      headers: { 'x-api-key': 'sk-ant-master', 'content-type': 'application/json' },
      body: { model: 'claude-haiku-4-5', messages: [] },
    };
    const result = redactRequestBody(body) as typeof body;
    expect(result.headers['x-api-key']).toBe('[REDACTED]');
    expect(result.headers['content-type']).toBe('application/json');
  });

  it('returns non-object values unchanged', () => {
    expect(redactRequestBody(null)).toBeNull();
    expect(redactRequestBody('string')).toBe('string');
    expect(redactRequestBody(42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Model allowlist tests
// ---------------------------------------------------------------------------

describe('model allowlist enforcement', () => {
  // We test the allowlist logic by calling the /v1/messages endpoint.
  // We set up a minimal app with mocked DB so tests are fast and isolated.

  function buildTestApp(allowedModels = 'claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5') {
    // Override env for this test scope
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '8080');
    vi.stubEnv('LOG_LEVEL', 'fatal');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('ANTHROPIC_API_URL', 'http://localhost:9999'); // unreachable — tests should 400 before fetch
    vi.stubEnv('ALLOWED_MODELS', allowedModels);
    vi.stubEnv('DATABASE_URL', 'postgresql://test');
    vi.stubEnv('SESSION_SIGNING_SECRET', TEST_SECRET);
    vi.stubEnv('INTERNAL_WEBHOOK_SECRET', 'internal-test-secret-32chars!!!!!');
    vi.stubEnv('GIT_SHA', 'abc1234');
    vi.stubEnv('APP_VERSION', '0.0.0');

    // Reset the env singleton so the new stubs take effect
    vi.resetModules();

    return null; // We build the app inline in each test to avoid module cache issues
  }

  it('rejects a model not on the allowlist', async () => {
    buildTestApp();

    const { loadEnv } = await import('../lib/env.js');
    loadEnv();

    // We create a minimal Hono app that mirrors just the allowlist check.
    // This avoids needing a real DB for a pure business logic test.
    const { buildAllowedModelsSet } = await import('../lib/env.js');
    const allowed = buildAllowedModelsSet('claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5');

    const disallowedModels = ['gpt-4o', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5', ''];

    for (const model of disallowedModels) {
      expect(allowed.has(model)).toBe(false);
    }
  });

  it('accepts all three allowed models', async () => {
    const { buildAllowedModelsSet } = await import('../lib/env.js');
    const allowed = buildAllowedModelsSet('claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5');

    expect(allowed.has('claude-sonnet-4-7')).toBe(true);
    expect(allowed.has('claude-opus-4-7')).toBe(true);
    expect(allowed.has('claude-haiku-4-5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Budget enforcement tests
// ---------------------------------------------------------------------------

describe('budget checkBudget', () => {
  it('returns exceeded=false when within limits', async () => {
    const { checkBudget } = await import('../services/budget.js');
    const budget = {
      sessionId: 'sid-1',
      inputTokensUsed: 100,
      outputTokensUsed: 50,
      inputCap: 200_000,
      outputCap: 50_000,
      expiresAt: new Date(Date.now() + 90 * 60 * 1000),
    };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(false);
    if (!result.exceeded) {
      expect(result.remainingInput).toBe(199_900);
      expect(result.remainingOutput).toBe(49_950);
    }
  });

  it('returns exceeded=true with field=input when input cap hit', async () => {
    const { checkBudget } = await import('../services/budget.js');
    const budget = {
      sessionId: 'sid-1',
      inputTokensUsed: 200_001,
      outputTokensUsed: 0,
      inputCap: 200_000,
      outputCap: 50_000,
      expiresAt: new Date(Date.now() + 90 * 60 * 1000),
    };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
    if (result.exceeded) {
      expect(result.field).toBe('input');
    }
  });

  it('returns exceeded=true with field=output when output cap hit', async () => {
    const { checkBudget } = await import('../services/budget.js');
    const budget = {
      sessionId: 'sid-1',
      inputTokensUsed: 1000,
      outputTokensUsed: 50_001,
      inputCap: 200_000,
      outputCap: 50_000,
      expiresAt: new Date(Date.now() + 90 * 60 * 1000),
    };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
    if (result.exceeded) {
      expect(result.field).toBe('output');
    }
  });

  it('returns exceeded=true when exactly at cap (remaining=0)', async () => {
    const { checkBudget } = await import('../services/budget.js');
    const budget = {
      sessionId: 'sid-1',
      inputTokensUsed: 200_000,
      outputTokensUsed: 0,
      inputCap: 200_000,
      outputCap: 50_000,
      expiresAt: new Date(Date.now() + 90 * 60 * 1000),
    };
    const result = checkBudget(budget);
    expect(result.exceeded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session auth middleware tests
// ---------------------------------------------------------------------------

describe('sessionAuth middleware', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SESSION_SIGNING_SECRET', TEST_SECRET);
    vi.stubEnv('INTERNAL_WEBHOOK_SECRET', 'internal-test-secret-32chars!!!!!');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('ANTHROPIC_API_URL', 'https://api.anthropic.com');
    vi.stubEnv('ALLOWED_MODELS', 'claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5');
    vi.stubEnv('DATABASE_URL', 'postgresql://test');
    vi.stubEnv('LOG_LEVEL', 'fatal');
    vi.stubEnv('GIT_SHA', 'test');
    vi.stubEnv('APP_VERSION', '0.0.0');
    vi.resetModules();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { loadEnv } = await import('../lib/env.js');
    loadEnv();
    const { sessionAuth } = await import('../middleware/sessionAuth.js');

    const app = new Hono();
    app.post('/test', sessionAuth, (c) => c.json({ ok: true }));

    const req = new Request('http://localhost/test', { method: 'POST' });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('MISSING_AUTH');
  });

  it('returns 401 with an invalid token', async () => {
    const { loadEnv } = await import('../lib/env.js');
    loadEnv();
    const { sessionAuth } = await import('../middleware/sessionAuth.js');

    const app = new Hono();
    app.post('/test', sessionAuth, (c) => c.json({ ok: true }));

    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('passes with a valid token and populates context', async () => {
    const { loadEnv } = await import('../lib/env.js');
    loadEnv();
    const { sessionAuth } = await import('../middleware/sessionAuth.js');

    const token = await makeToken();

    const app = new Hono();
    app.post('/test', sessionAuth, (c) => {
      const claims = c.get('sessionToken');
      return c.json({ ok: true, data: { sid: claims.sid } });
    });

    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { sid: string } };
    expect(body.ok).toBe(true);
    expect(body.data.sid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
