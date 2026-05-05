import { createDbClient } from '@claudekloud/db';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';

import { createApp, LISTENER_INTERFACE_HEADER, type ListenerInterface } from './app.js';
import { loadEnv, resolvePublicPort } from './lib/env.js';
import { getLogger } from './lib/logger.js';

// Load and validate env first — throws ZodError with field-level detail if any
// required variable is missing.
const env = loadEnv();
const logger = getLogger();

const db = createDbClient(env.DATABASE_URL);
const app = createApp({ db });

const publicPort = resolvePublicPort(env);
const internalPort = env.INTERNAL_PORT;

/**
 * Build a fetch handler that stamps every inbound request with the
 * X-Listener-Interface internal header before the Hono app processes it.
 *
 * We clone the request and add the header rather than using a wrapper app so
 * that the main app's context is the one that runs the gate middleware.
 * This keeps server.ts thin: it owns "which port maps to which interface" and
 * nothing else.
 */
function makeFetch(
  iface: ListenerInterface,
): (request: Request, env: unknown) => Promise<Response> {
  return async (req: Request) => {
    const headers = new Headers(req.headers);
    headers.set(LISTENER_INTERFACE_HEADER, iface);
    const stamped = new Request(req, { headers });
    return app.fetch(stamped);
  };
}

// The public listener serves /healthz, /readyz, and /v1/*.
// The internal listener serves /internal/*.
// Both call into the same Hono app; the interface gate in app.ts enforces the
// separation using the X-Listener-Interface header.
const publicServer = serve(
  {
    fetch: makeFetch('public'),
    port: publicPort,
  },
  (info) => {
    logger.info(
      {
        port: info.port,
        interface: 'public',
        version: env.APP_VERSION,
        gitSha: env.GIT_SHA,
        nodeEnv: env.NODE_ENV,
      },
      'claudekloud-proxy public listener started',
    );
  },
);

const internalServer = serve(
  {
    fetch: makeFetch('internal'),
    port: internalPort,
  },
  (info) => {
    logger.info(
      { port: info.port, interface: 'internal' },
      'claudekloud-proxy internal listener started',
    );
  },
);

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  let closed = 0;
  const onClose = () => {
    closed += 1;
    if (closed === 2) {
      logger.info('all servers closed');
      process.exit(0);
    }
  };
  (publicServer as ServerType).close(onClose);
  (internalServer as ServerType).close(onClose);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
