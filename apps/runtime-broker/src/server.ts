import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';

import { createApp } from './app.js';
import { loadEnv } from './lib/env.js';
import { getLogger } from './lib/logger.js';
import { createWsServer, handleUpgrade } from './routes/attach.js';
import { killContainer } from './services/docker.js';
import { getIdleSessions, deleteSession, listSessions } from './services/sessions.js';

// Load and validate env first — throws ZodError with field-level detail on failure
const env = loadEnv();
const logger = getLogger();
const app = createApp();

// Build the Node http.Server via @hono/node-server so we can attach the WS
// upgrade handler to the same port.
const server = serve(
  {
    fetch: app.fetch,
    port: env.BROKER_PORT,
    hostname: '127.0.0.1',
  },
  (info) => {
    logger.info(
      { port: info.port, hostname: '127.0.0.1', nodeEnv: env.NODE_ENV },
      'claudekloud-runtime-broker started',
    );
  },
) as ServerType;

// Attach WS upgrade handler to the raw http.Server
const wss = createWsServer();

// @hono/node-server's ServerType exposes the underlying http.Server as .server
// when used with the overload that returns a server.
// The actual Node http.Server emits 'upgrade' — we access it via the cast below.
// @ts-expect-error: ServerType does not expose .server in public types but @hono/node-server wraps http.Server
const httpServer: import('node:http').Server = server;

httpServer.on('upgrade', (req, socket, head) => {
  const handled = handleUpgrade(wss, req, socket, head);
  if (!handled) {
    socket.destroy();
  }
});

// ---------------------------------------------------------------------------
// Idle reaper — scans every 60s, kills containers idle > IDLE_TIMEOUT_MS
// ---------------------------------------------------------------------------
const reaperInterval = setInterval(async () => {
  const idle = getIdleSessions(env.IDLE_TIMEOUT_MS);
  for (const entry of idle) {
    logger.info(
      { session_id: entry.session_id, container_id: entry.container_id },
      'reaping idle session',
    );
    try {
      await killContainer(entry.container_id);
    } catch {
      // already logged inside killContainer
    }
    deleteSession(entry.session_id);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Graceful shutdown — kill all tracked containers, then exit
// ---------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down runtime-broker');

  clearInterval(reaperInterval);

  const sessions = listSessions();
  logger.info({ count: sessions.length }, 'killing tracked containers');

  await Promise.allSettled(
    sessions.map((entry) =>
      killContainer(entry.container_id).catch((e: unknown) => {
        logger.warn(
          { container_id: entry.container_id, error: e instanceof Error ? e.message : String(e) },
          'shutdown kill failed',
        );
      }),
    ),
  );

  // Wait up to 5s for the HTTP server to drain, then force-exit
  const forceExit = setTimeout(() => {
    logger.warn('force-exit after timeout');
    process.exit(1);
  }, 5_000);

  server.close(() => {
    clearTimeout(forceExit);
    logger.info('server closed — exiting cleanly');
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
