import pino from 'pino';

import { getEnv } from './env.js';

let _logger: pino.Logger | undefined;

/**
 * Return the singleton pino logger.
 * Axiom ingests logs via Fly.io log shipping — we write JSON to stdout.
 * The AXIOM_TOKEN and AXIOM_DATASET env vars are read by the Fly log shipper,
 * not by this process.
 */
export function getLogger(): pino.Logger {
  if (_logger) return _logger;

  const env = getEnv();

  _logger = pino({
    level: env.LOG_LEVEL,
    base: {
      service: 'claudekloud-proxy',
      version: env.APP_VERSION,
      env: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });

  return _logger;
}
