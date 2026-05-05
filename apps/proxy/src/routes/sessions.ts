import type { DbClient } from '@claudekloud/db';
import { issueSessionToken } from '@claudekloud/session-token';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getEnv } from '../lib/env.js';
import { ok, err } from '../lib/response.js';
import { internalAuth } from '../middleware/internalAuth.js';
import { ensureSessionBudget } from '../services/budget.js';

const createSessionSchema = z.object({
  user_id: z.string().min(1),
  lab_id: z.string().min(1),
  session_id: z.string().uuid(),
  budget_tier: z.enum(['standard', 'extended', 'long-context']),
  model_pin: z.string().optional(),
});

interface SessionDeps {
  db: DbClient;
}

export function createSessionsRouter(deps: SessionDeps) {
  const router = new Hono();

  /**
   * POST /internal/sessions
   * Mints a session token for a new lab session.
   * Protected by the shared INTERNAL_WEBHOOK_SECRET header.
   * Called by the broker after it spins up a lab container.
   */
  router.post(
    '/internal/sessions',
    internalAuth,
    zValidator('json', createSessionSchema, (result, c) => {
      if (!result.success) {
        // Returning the response from the validator callback halts the handler chain
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
      const body = c.req.valid('json');
      const env = getEnv();

      // Token expiry: 95 minutes from now
      const expiresAt = new Date(Date.now() + 95 * 60 * 1000);

      // Ensure the session budget row exists before issuing the token
      try {
        await ensureSessionBudget(deps.db, body.session_id, body.budget_tier, expiresAt);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Database error';
        return err(c, 500, 'DB_ERROR', `Failed to create session budget: ${message}`);
      }

      let token: string;
      try {
        token = await issueSessionToken(
          {
            sub: body.user_id,
            sid: body.session_id,
            lab: body.lab_id,
            budget_tier: body.budget_tier,
            model_pin: body.model_pin,
          },
          env.SESSION_SIGNING_SECRET,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Token signing error';
        return err(c, 500, 'TOKEN_ERROR', `Failed to issue session token: ${message}`);
      }

      return ok(c, { token, expires_at: expiresAt.toISOString() }, 201);
    },
  );

  return router;
}
