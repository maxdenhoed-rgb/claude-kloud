import type { DbClient } from '@claudekloud/db';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';

import { err } from './lib/response.js';
import { createHealthRouter } from './routes/health.js';
import { createLabImageReleaseRouter } from './routes/labImageRelease.js';
import { createMessagesRouter } from './routes/messages.js';
import { createSessionsRouter } from './routes/sessions.js';

interface AppDeps {
  db: DbClient;
}

/**
 * Which network listener accepted this connection.
 * server.ts stamps the internal header X-Listener-Interface on every request
 * before it reaches the Hono router; the interface gate middleware reads it.
 */
export type ListenerInterface = 'public' | 'internal';

/**
 * Internal header name.  Using a header (rather than a Hono context variable)
 * means the gate works correctly even when requests are proxied through the
 * thin wrapper listeners defined in server.ts — the header survives the
 * Request reconstruction.  Tests can set this header directly.
 *
 * This header must NEVER be forwarded to upstream services (the forwardHeaders
 * filter in the messages route already strips non-Anthropic headers).
 */
export const LISTENER_INTERFACE_HEADER = 'x-listener-interface';

declare module 'hono' {
  interface ContextVariableMap {
    interface: ListenerInterface;
  }
}

/**
 * Assemble the Hono application.
 * Accepts dependencies so that tests can inject mocks.
 *
 * Every request must carry the internal header X-Listener-Interface
 * ("public" | "internal"), set by the per-listener preamble in server.ts.
 * Routes are gated:
 *   public   → /healthz, /readyz, /v1/*
 *   internal → /internal/*
 * Cross-interface requests receive HTTP 404 (not 403 — reveals less).
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Request logging via Hono's built-in logger (writes to stdout)
  app.use('*', honoLogger());

  // Resolve listener interface from the internal header and store in context.
  app.use('*', async (c, next) => {
    const raw = c.req.header(LISTENER_INTERFACE_HEADER);
    const iface: ListenerInterface = raw === 'internal' ? 'internal' : 'public';
    c.set('interface', iface);
    await next();
  });

  // Interface gate: /internal/* is only reachable via the internal listener.
  app.use('/internal/*', async (c, next) => {
    if (c.get('interface') !== 'internal') {
      return err(c, 404, 'NOT_FOUND', `${c.req.method} ${c.req.path} not found`);
    }
    await next();
    return c.res;
  });

  // Interface gate: /v1/* is only reachable via the public listener.
  app.use('/v1/*', async (c, next) => {
    if (c.get('interface') !== 'public') {
      return err(c, 404, 'NOT_FOUND', `${c.req.method} ${c.req.path} not found`);
    }
    await next();
    return c.res;
  });

  // Health routes (unauthenticated, accessible on both listeners)
  app.route('/', createHealthRouter(deps));

  // Internal broker / CI routes
  app.route('/', createSessionsRouter(deps));
  app.route('/', createLabImageReleaseRouter(deps));

  // Anthropic forward
  app.route('/', createMessagesRouter(deps));

  // 404 fallback
  app.notFound((c) => err(c, 404, 'NOT_FOUND', `${c.req.method} ${c.req.path} not found`));

  // Global error handler
  app.onError((e, c) => {
    return err(c, 500, 'INTERNAL_ERROR', e.message ?? 'An unexpected error occurred');
  });

  return app;
}
