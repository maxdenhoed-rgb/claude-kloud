import pino from 'pino';

import { getEnv } from './env.js';

let _logger: pino.Logger | undefined;

/**
 * Return the singleton pino logger.
 * Writes JSON to stdout.
 */
export function getLogger(): pino.Logger {
  if (_logger) return _logger;

  const env = getEnv();

  _logger = pino({
    level: env.LOG_LEVEL,
    base: {
      service: 'claudekloud-runtime-broker',
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
