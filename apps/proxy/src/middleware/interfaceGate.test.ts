import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the two-listener interface gate (L-3 security fix).
 *
 * The gate relies on the X-Listener-Interface header that server.ts stamps on
 * every request before it reaches the Hono router.  Tests set the header
 * directly to simulate which listener accepted the connection.
 *
 * We test the routing logic itself — not real TCP listeners — so these tests
 * are fast, deterministic, and free of port conflicts.
 */

const WEBHOOK_SECRET = 'internal-test-secret-32chars!!!!!';
const TEST_SIGNING_SECRET = 'test-signing-secret-at-least-32-chars-long!!';

function setupEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('PORT', '8080');
  vi.stubEnv('LOG_LEVEL', 'fatal');
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
  vi.stubEnv('ANTHROPIC_API_URL', 'http://localhost:9999');
  vi.stubEnv('ALLOWED_MODELS', 'claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5');
  vi.stubEnv('DATABASE_URL', 'postgresql://test');
  vi.stubEnv('SESSION_SIGNING_SECRET', TEST_SIGNING_SECRET);
  vi.stubEnv('INTERNAL_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.stubEnv('GIT_SHA', 'test');
  vi.stubEnv('APP_VERSION', '0.0.0');
  vi.resetModules();
}

/** Minimal mock DbClient — no real DB calls needed for gate tests. */
function makeMockDb() {
  return {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

async function buildTestApp() {
  const { loadEnv } = await import('../lib/env.js');
  loadEnv();
  const { createApp, LISTENER_INTERFACE_HEADER } = await import('../app.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = createApp({ db: makeMockDb() as any });
  return { app, LISTENER_INTERFACE_HEADER };
}

describe('interface gate — /internal/* routes', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('returns 404 when /internal/sessions is accessed via the public listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();

    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        [LISTENER_INTERFACE_HEADER]: 'public',
        'x-webhook-secret': WEBHOOK_SECRET,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'user_test',
        lab_id: 'lab-01',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        budget_tier: 'standard',
      }),
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('reaches the /internal/sessions handler (past the gate) when accessed via the internal listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();

    // The route will still fail (missing auth or DB error) but the gate itself
    // must pass — the response must NOT be a 404 from the gate.
    const req = new Request('http://localhost/internal/sessions', {
      method: 'POST',
      headers: {
        [LISTENER_INTERFACE_HEADER]: 'internal',
        'x-webhook-secret': WEBHOOK_SECRET,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'user_test',
        lab_id: 'lab-01',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        budget_tier: 'standard',
      }),
    });

    const res = await app.fetch(req);
    // The gate passed; the route hit the DB mock and likely threw a 500, but
    // crucially it is NOT a 404 from the interface gate.
    expect(res.status).not.toBe(404);
  });
});

describe('interface gate — /v1/* routes', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('returns 404 when /v1/messages is accessed via the internal listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();

    const req = new Request('http://localhost/v1/messages', {
      method: 'POST',
      headers: {
        [LISTENER_INTERFACE_HEADER]: 'internal',
        'content-type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [] }),
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('reaches the /v1/messages handler (past the gate) when accessed via the public listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();

    // The route will reject (invalid token) but the gate itself must pass.
    const req = new Request('http://localhost/v1/messages', {
      method: 'POST',
      headers: {
        [LISTENER_INTERFACE_HEADER]: 'public',
        'content-type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [] }),
    });

    const res = await app.fetch(req);
    // The gate passed; sessionAuth rejected the fake token with 401.
    expect(res.status).toBe(401);
  });
});

describe('interface gate — /healthz is accessible on both listeners', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('responds on the public listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();
    const req = new Request('http://localhost/healthz', {
      headers: { [LISTENER_INTERFACE_HEADER]: 'public' },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it('responds on the internal listener', async () => {
    const { app, LISTENER_INTERFACE_HEADER } = await buildTestApp();
    const req = new Request('http://localhost/healthz', {
      headers: { [LISTENER_INTERFACE_HEADER]: 'internal' },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });
});
