import { describe, it, expect } from 'vitest';

import { issueSessionToken, verifySessionToken } from './index.js';

const SECRET = 'test-secret-must-be-long-enough-for-hs256-minimum';

const BASE_CLAIMS = {
  sub: 'user_clerk_abc123',
  sid: '550e8400-e29b-41d4-a716-446655440000',
  lab: '01-agentic-architecture/lab-01',
  budget_tier: 'standard' as const,
};

describe('issueSessionToken', () => {
  it('returns a compact JWT string', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    // Compact JWTs have exactly 3 dot-separated parts
    expect(token.split('.')).toHaveLength(3);
  });

  it('includes all required claims when verified', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    const payload = await verifySessionToken(token, SECRET);

    expect(payload.sub).toBe(BASE_CLAIMS.sub);
    expect(payload.sid).toBe(BASE_CLAIMS.sid);
    expect(payload.lab).toBe(BASE_CLAIMS.lab);
    expect(payload.budget_tier).toBe('standard');
    expect(payload.iss).toBe('claudekloud-proxy');
    expect(payload.aud).toBe('claudekloud-lab');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('sets exp approximately 95 minutes after iat', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    const diffSeconds = payload.exp - payload.iat;
    // Allow 5-second variance for test execution time
    expect(diffSeconds).toBeGreaterThanOrEqual(95 * 60 - 5);
    expect(diffSeconds).toBeLessThanOrEqual(95 * 60 + 5);
  });

  it('includes optional model_pin when provided', async () => {
    const token = await issueSessionToken(
      { ...BASE_CLAIMS, model_pin: 'claude-haiku-4-5' },
      SECRET,
    );
    const payload = await verifySessionToken(token, SECRET);
    expect(payload.model_pin).toBe('claude-haiku-4-5');
  });

  it('omits model_pin from payload when not provided', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload.model_pin).toBeUndefined();
  });

  it('includes extra_models when provided', async () => {
    const token = await issueSessionToken(
      { ...BASE_CLAIMS, extra_models: ['claude-sonnet-4-7'] },
      SECRET,
    );
    const payload = await verifySessionToken(token, SECRET);
    expect(payload.extra_models).toEqual(['claude-sonnet-4-7']);
  });
});

describe('verifySessionToken', () => {
  it('rejects a token signed with a different secret', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    await expect(verifySessionToken(token, 'wrong-secret')).rejects.toThrow();
  });

  it('rejects a tampered token (modified payload)', async () => {
    const token = await issueSessionToken(BASE_CLAIMS, SECRET);
    const parts = token.split('.');
    // Flip one byte in the payload section
    const tamperedPayload = parts[1]!.slice(0, -2) + 'XX';
    const tampered = [parts[0], tamperedPayload, parts[2]].join('.');
    await expect(verifySessionToken(tampered, SECRET)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    // Issue a token with a very short expiry by manipulating time.
    // We sign a token whose exp is in the past by building the payload manually.
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Use jose directly to build an already-expired token
    const { SignJWT } = await import('jose');
    const expiredToken = await new SignJWT({
      sid: BASE_CLAIMS.sid,
      lab: BASE_CLAIMS.lab,
      budget_tier: BASE_CLAIMS.budget_tier,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('claudekloud-proxy')
      .setAudience('claudekloud-lab')
      .setSubject(BASE_CLAIMS.sub)
      .setIssuedAt(nowSeconds - 7200)
      .setExpirationTime(nowSeconds - 3600)
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifySessionToken(expiredToken, SECRET)).rejects.toThrow();
  });

  it('rejects a token with wrong audience', async () => {
    const { SignJWT } = await import('jose');
    const wrongAudToken = await new SignJWT({
      sid: BASE_CLAIMS.sid,
      lab: BASE_CLAIMS.lab,
      budget_tier: BASE_CLAIMS.budget_tier,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('claudekloud-proxy')
      .setAudience('wrong-audience')
      .setSubject(BASE_CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime('95m')
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifySessionToken(wrongAudToken, SECRET)).rejects.toThrow();
  });

  it('accepts extended and long-context budget tiers', async () => {
    for (const tier of ['extended', 'long-context'] as const) {
      const token = await issueSessionToken({ ...BASE_CLAIMS, budget_tier: tier }, SECRET);
      const payload = await verifySessionToken(token, SECRET);
      expect(payload.budget_tier).toBe(tier);
    }
  });
});
