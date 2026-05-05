import { labImageReleases } from '@claudekloud/db';
import type { DbClient } from '@claudekloud/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getLogger } from '../lib/logger.js';
import { ok, err } from '../lib/response.js';
import { internalAuth } from '../middleware/internalAuth.js';

const releaseSchema = z.object({
  image_ref: z.string().min(1),
  digest: z.string().min(1),
  git_sha: z.string().min(1),
  triggered_by: z.string().min(1),
});

interface LabImageReleaseDeps {
  db: DbClient;
}

export function createLabImageReleaseRouter(deps: LabImageReleaseDeps) {
  const router = new Hono();

  /**
   * POST /internal/lab-image-release
   * Called by the lab-image CI workflow after each successful image build.
   * Inserts a row into lab_image_releases so the broker knows the current
   * canonical image digest without polling the registry.
   * Idempotent on digest — a duplicate digest returns 200 rather than an error.
   */
  router.post(
    '/internal/lab-image-release',
    internalAuth,
    zValidator('json', releaseSchema, (result, c) => {
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
      const logger = getLogger();

      try {
        await deps.db
          .insert(labImageReleases)
          .values({
            imageRef: body.image_ref,
            digest: body.digest,
            gitSha: body.git_sha,
            triggeredBy: body.triggered_by,
          })
          .onConflictDoNothing();

        logger.info(
          { digest: body.digest, gitSha: body.git_sha, triggeredBy: body.triggered_by },
          'lab image release recorded',
        );

        return ok(c, {
          digest: body.digest,
          image_ref: body.image_ref,
          git_sha: body.git_sha,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Database error';
        logger.error({ err: e }, 'failed to record lab image release');
        return err(c, 500, 'DB_ERROR', `Failed to record release: ${message}`);
      }
    },
  );

  return router;
}
