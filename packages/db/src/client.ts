import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

/**
 * Create a Drizzle client from a connection string.
 * The proxy creates one instance at startup and passes it to services.
 * Max connections is intentionally low — the proxy is a single small
 * Fly.io machine with a 200-request hard concurrency limit.
 */
export function createDbClient(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
