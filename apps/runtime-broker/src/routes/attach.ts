import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer } from 'ws';

import { getLogger } from '../lib/logger.js';
import { attachExec } from '../services/docker.js';
import { bumpActivity, getSession } from '../services/sessions.js';

// Matches /sessions/<uuid>/attach
const ATTACH_PATH_RE = /^\/sessions\/([^/]+)\/attach$/;

/**
 * Create a WebSocketServer in noServer mode.
 * The caller (server.ts) must route HTTP upgrade events to `handleUpgrade`.
 *
 * On connection:
 *  1. Parse session_id from the URL path.
 *  2. Look up the session registry.
 *  3. Attach a docker exec PTY and pump bytes both directions.
 *  4. Keep the WS alive with 30s pings.
 */
export function createWsServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const logger = getLogger();

  wss.on('connection', (ws, req) => {
    const url = req.url ?? '';
    const match = ATTACH_PATH_RE.exec(url);

    if (!match || !match[1]) {
      logger.warn({ url }, 'ws connection rejected: invalid path');
      ws.close(4004, 'Not Found');
      return;
    }

    const session_id = match[1];
    const entry = getSession(session_id);

    if (!entry) {
      logger.warn({ session_id }, 'ws connection rejected: session not found');
      ws.close(4004, 'Session not found');
      return;
    }

    logger.info({ session_id, container_id: entry.container_id }, 'ws attach');

    // 30-second keep-alive ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        bumpActivity(session_id);
      }
    }, 30_000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });

    // Attach exec — errors inside are logged by docker.ts
    attachExec(entry.container_id, session_id, ws).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error({ session_id, error: msg }, 'attachExec failed');
      ws.close(4500, 'Internal error');
    });
  });

  return wss;
}

/**
 * Route an HTTP upgrade request to the WS server if the path matches.
 * Returns true if the upgrade was handled, false otherwise.
 */
export function handleUpgrade(
  wss: WebSocketServer,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): boolean {
  const url = req.url ?? '';

  if (!ATTACH_PATH_RE.test(url)) {
    return false;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });

  return true;
}
