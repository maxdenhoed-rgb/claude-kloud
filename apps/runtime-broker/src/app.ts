import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';

import { err } from './lib/response.js';
import { createSessionsRouter } from './routes/sessions.js';

/**
 * Assemble the Hono HTTP application.
 * WebSocket handling is wired separately in server.ts via the raw Node http.Server.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.use('*', honoLogger());

  // CORS — the demo web UI runs on http://localhost:3000 and the broker on
  // :3001, so the browser issues a preflight OPTIONS before each POST/DELETE.
  // Allow only the local web origins; broker is bound to 127.0.0.1 so this
  // surface is unreachable beyond the same machine regardless.
  app.use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type'],
      maxAge: 600,
    }),
  );

  app.route('/', createSessionsRouter());

  // Health
  app.get('/healthz', (c) => c.json({ ok: true, data: { status: 'healthy' } }));

  app.notFound((c) => err(c, 404, 'NOT_FOUND', `${c.req.method} ${c.req.path} not found`));

  app.onError((e, c) => {
    return err(c, 500, 'INTERNAL_ERROR', e.message ?? 'An unexpected error occurred');
  });

  return app;
}
