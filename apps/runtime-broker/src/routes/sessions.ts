import { randomUUID } from 'node:crypto';

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getEnv } from '../lib/env.js';
import { err, ok } from '../lib/response.js';
import { bootContainer, killContainer } from '../services/docker.js';
import { mintSessionToken } from '../services/proxyClient.js';
import { createSession, deleteSession, getSession } from '../services/sessions.js';

const createSessionSchema = z.object({
  lab_id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9._-]+$/, 'lab_id must be alphanumeric with . _ -'),
});

export function createSessionsRouter(): Hono {
  const router = new Hono();

  /**
   * POST /sessions
   * Boot a lab container and return a session_id + WS attach URL.
   */
  router.post(
    '/sessions',
    zValidator('json', createSessionSchema, (result, c) => {
      if (!result.success) {
        return err(
          c,
          400,
          'INVALID_BODY',
          'Request body validation failed',
          result.error.flatten(),
        ) as never;
      }
    }),
    async (c) => {
      const env = getEnv();
      const { lab_id } = c.req.valid('json');
      const session_id = randomUUID();

      // 1. Mint a session JWT via the proxy
      let jwt: string;
      try {
        const proxyRes = await mintSessionToken('demo-user', lab_id, session_id, 'standard');
        jwt = proxyRes.token;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err(c, 503, 'PROXY_UNAVAILABLE', message);
      }

      // 2. Boot the lab container
      let container_id: string;
      try {
        container_id = await bootContainer({ jwt, sessionId: session_id, labId: lab_id });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err(c, 500, 'CONTAINER_START_FAILED', message);
      }

      // 3. Register the session
      createSession(session_id, lab_id, container_id);

      const ws_url = `ws://localhost:${env.BROKER_PORT}/sessions/${session_id}/attach`;

      return ok(c, { session_id, ws_url }, 201);
    },
  );

  /**
   * DELETE /sessions/:id
   * Kill the container and remove the session from the registry.
   * Idempotent.
   */
  router.delete('/sessions/:id', async (c) => {
    const session_id = c.req.param('id');
    const entry = getSession(session_id);

    if (!entry) {
      // Already gone — idempotent success
      return ok(c, { deleted: false });
    }

    try {
      await killContainer(entry.container_id);
    } catch {
      // Log inside killContainer; surface as best-effort — still remove from registry
    }

    deleteSession(session_id);

    return ok(c, { deleted: true });
  });

  return router;
}
