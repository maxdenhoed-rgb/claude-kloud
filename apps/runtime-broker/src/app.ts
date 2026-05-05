import { Hono } from 'hono';
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

  app.route('/', createSessionsRouter());

  // Health
  app.get('/healthz', (c) => c.json({ ok: true, data: { status: 'healthy' } }));

  app.notFound((c) => err(c, 404, 'NOT_FOUND', `${c.req.method} ${c.req.path} not found`));

  app.onError((e, c) => {
    return err(c, 500, 'INTERNAL_ERROR', e.message ?? 'An unexpected error occurred');
  });

  return app;
}
