import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_SECRET = 'test-signing-secret-at-least-32-chars-long!!';
const WRONG_SECRET = 'wrong-signing-secret-at-least-32-chars-long!';

/** Fixed external error message that must appear for every JWT failure */
const FIXED_ERROR_MSG = 'Token is invalid or expired';

function encodeKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Mint a valid token signed with TEST_SECRET (correct iss/aud/exp). */
async function mintValid(): Promise<string> {
  return new SignJWT({ sid: 'test-sid', lab: 'lab-01', budget_tier: 'standard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('claudekloud-proxy')
    .setAudience('claudekloud-lab')
    .setSubject('user_test_001')
    .setIssuedAt()
    .setExpirationTime('95m')
    .sign(encodeKey(TEST_SECRET));
}

/** Mint a token with a tampered signature (signed with a different key). */
async function mintTamperedSignature(): Promise<string> {
  return new SignJWT({ sid: 'test-sid', lab: 'lab-01', budget_tier: 'standard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('claudekloud-proxy')
    .setAudience('claudekloud-lab')
    .setSubject('user_test_001')
    .setIssuedAt()
    .setExpirationTime('95m')
    .sign(encodeKey(WRONG_SECRET));
}

/** Mint a token that expired 60 seconds ago. */
async function mintExpired(): Promise<string> {
  return new SignJWT({ sid: 'test-sid', lab: 'lab-01', budget_tier: 'standard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('claudekloud-proxy')
    .setAudience('claudekloud-lab')
    .setSubject('user_test_001')
    .setIssuedAt()
    .setExpirationTime('-60s')
    .sign(encodeKey(TEST_SECRET));
}

/** Mint a token with the wrong audience. */
async function mintWrongAudience(): Promise<string> {
  return new SignJWT({ sid: 'test-sid', lab: 'lab-01', budget_tier: 'standard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('claudekloud-proxy')
    .setAudience('wrong-audience')
    .setSubject('user_test_001')
    .setIssuedAt()
    .setExpirationTime('95m')
    .sign(encodeKey(TEST_SECRET));
}

/** Mint a token with the wrong issuer. */
async function mintWrongIssuer(): Promise<string> {
  return new SignJWT({ sid: 'test-sid', lab: 'lab-01', budget_tier: 'standard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('wrong-issuer')
    .setAudience('claudekloud-lab')
    .setSubject('user_test_001')
    .setIssuedAt()
    .setExpirationTime('95m')
    .sign(encodeKey(TEST_SECRET));
}

function setupEnv() {
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
}

async function buildApp() {
  const { loadEnv } = await import('../lib/env.js');
  loadEnv();
  const { sessionAuth } = await import('./sessionAuth.js');
  const app = new Hono();
  app.post('/test', sessionAuth, (c) => c.json({ ok: true }));
  return app;
}

type ErrorBody = { ok: boolean; error: { code: string; message: string } };

describe('sessionAuth middleware — generic error message (H-1b)', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('returns 401 with fixed message for a tampered signature', async () => {
    const app = await buildApp();
    const token = await mintTamperedSignature();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toBe(FIXED_ERROR_MSG);
  });

  it('returns 401 with fixed message for an expired token', async () => {
    const app = await buildApp();
    const token = await mintExpired();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toBe(FIXED_ERROR_MSG);
  });

  it('returns 401 with fixed message for a wrong audience', async () => {
    const app = await buildApp();
    const token = await mintWrongAudience();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toBe(FIXED_ERROR_MSG);
  });

  it('returns 401 with fixed message for a wrong issuer', async () => {
    const app = await buildApp();
    const token = await mintWrongIssuer();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toBe(FIXED_ERROR_MSG);
  });

  it('passes with a valid token and returns 200', async () => {
    const app = await buildApp();
    const token = await mintValid();
    const res = await app.fetch(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
