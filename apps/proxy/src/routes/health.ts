import type { DbClient } from '@claudekloud/db';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { getEnv } from '../lib/env.js';
import { ok, err } from '../lib/response.js';

interface HealthDeps {
  db: DbClient;
}

export function createHealthRouter(deps: HealthDeps) {
  const router = new Hono();

  /**
   * GET /healthz
   * Lightweight liveness check — returns immediately without hitting the DB.
   * Used by the Fly http_service check and the proxy Dockerfile HEALTHCHECK.
   */
  router.get('/healthz', (c) => {
    const env = getEnv();
    return ok(c, {
      status: 'healthy',
      version: env.APP_VERSION,
      gitSha: env.GIT_SHA,
    });
  });

  /**
   * GET /readyz
   * Deep readiness check — verifies Postgres reachability.
   * Axiom reachability is not probed here because Axiom is log-shipping only
   * (Fly forwards stdout); there is no inbound Axiom connection to check.
   */
  router.get('/readyz', async (c) => {
    const checks: Record<string, 'ok' | 'error'> = {
      postgres: 'error',
    };

    try {
      await deps.db.execute(sql`SELECT 1`);
      checks['postgres'] = 'ok';
    } catch {
      // postgres check already marked "error"
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    if (!allOk) {
      return err(c, 503, 'NOT_READY', 'One or more dependency checks failed', checks);
    }

    return ok(c, { status: 'ready', checks });
  });

  return router;
}
