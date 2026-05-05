import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BROKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // URL of the proxy's internal listener (no trailing slash)
  PROXY_INTERNAL_URL: z.string().url().default('http://localhost:8081'),

  // Shared secret for proxy /internal/* endpoints — must match the proxy's value exactly
  INTERNAL_WEBHOOK_SECRET: z.string().min(32),

  // JWT signing secret — broker does not sign tokens but must match proxy for documentation parity
  SESSION_SIGNING_SECRET: z.string().min(32),

  // Base URL injected into lab containers as ANTHROPIC_BASE_URL
  ANTHROPIC_PROXY_BASE_URL: z.string().url().default('http://host.docker.internal:8080'),

  // Docker image used for lab containers
  LAB_IMAGE: z.string().min(1).default('lab-base:local'),

  // Idle timeout in milliseconds before a container is reaped (default 20 min)
  IDLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 60 * 1000),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

/**
 * Parse and validate environment variables once.
 * Throws a ZodError with field-level detail if any required var is missing.
 */
export function loadEnv(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

/**
 * Return the already-loaded env (throws if loadEnv() was not called yet).
 */
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not loaded — call loadEnv() at startup');
  }
  return _env;
}
