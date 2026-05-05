import { verifySessionToken } from '@claudekloud/session-token';
import type { VerifiedSessionToken } from '@claudekloud/session-token';
import type { Context, Next } from 'hono';

import { getEnv } from '../lib/env.js';
import { getLogger } from '../lib/logger.js';
import { err } from '../lib/response.js';

declare module 'hono' {
  interface ContextVariableMap {
    sessionToken: VerifiedSessionToken;
  }
}

/**
 * Middleware that verifies the Bearer session token on /v1/* routes.
 * Extracts the token from the Authorization header, verifies the HS256
 * signature, and stores the parsed claims in context variables.
 */
export async function sessionAuth(c: Context, next: Next): Promise<Response> {
  const authHeader = c.req.header('authorization') ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    return err(c, 401, 'MISSING_AUTH', 'Authorization header required');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return err(c, 401, 'MISSING_AUTH', 'Bearer token is empty');
  }

  const env = getEnv();
  const requestId = c.req.header('x-request-id') ?? undefined;

  try {
    const claims = await verifySessionToken(token, env.SESSION_SIGNING_SECRET);
    c.set('sessionToken', claims);
  } catch (e) {
    // Log the detailed error server-side; never expose which check failed.
    getLogger().warn({ err: e, requestId }, 'session token verification failed');
    return err(c, 401, 'INVALID_TOKEN', 'Token is invalid or expired');
  }

  await next();
  // Hono requires returning the response after awaiting next()
  return c.res;
}
