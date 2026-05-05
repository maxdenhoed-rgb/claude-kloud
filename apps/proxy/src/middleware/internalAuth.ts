import { timingSafeEqual } from 'node:crypto';

import type { Context, Next } from 'hono';

import { getEnv } from '../lib/env.js';
import { err } from '../lib/response.js';

/**
 * Middleware that validates the X-Webhook-Secret header for /internal/*
 * endpoints.  Only the broker (on the Fly private network) and CI workflows
 * (via the INTERNAL_WEBHOOK_SECRET GitHub Actions secret) may call these.
 *
 * The comparison uses timingSafeEqual on equal-length Buffers so that neither
 * a wrong value nor a wrong-length candidate leaks information via response
 * timing.  When lengths differ we still perform the equal-length compare
 * (against a dummy buffer the size of the env secret) before rejecting.
 */
export async function internalAuth(c: Context, next: Next): Promise<Response> {
  const candidate = c.req.header('x-webhook-secret') ?? '';
  const env = getEnv();

  const expected = Buffer.from(env.INTERNAL_WEBHOOK_SECRET, 'utf8');
  const supplied = Buffer.from(candidate, 'utf8');

  // Always compare buffers of the same length to prevent timing oracle on
  // the candidate's length.  We compare against a dummy buffer when sizes
  // differ so the work done is constant regardless of the input length.
  const compareTarget =
    supplied.length === expected.length ? supplied : Buffer.alloc(expected.length);

  const valid = timingSafeEqual(expected, compareTarget) && supplied.length === expected.length;

  if (!valid) {
    return err(c, 403, 'FORBIDDEN', 'Invalid or missing X-Webhook-Secret');
  }

  await next();
  return c.res;
}
