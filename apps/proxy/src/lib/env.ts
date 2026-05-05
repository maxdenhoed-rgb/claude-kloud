import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // PORT is kept as an alias for PUBLIC_PORT for backwards compatibility.
  // Precedence: PUBLIC_PORT > PORT > 8080.
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PUBLIC_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  INTERNAL_PORT: z.coerce.number().int().min(1).max(65535).default(8081),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Anthropic upstream
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_API_URL: z.string().url().default('https://api.anthropic.com'),

  // Model allowlist (comma-separated, validated against CLAUDE.md critical rules)
  ALLOWED_MODELS: z.string().default('claude-sonnet-4-7,claude-opus-4-7,claude-haiku-4-5'),

  // Postgres
  DATABASE_URL: z.string().min(1),

  // JWT signing secret for session tokens
  SESSION_SIGNING_SECRET: z.string().min(32),

  // Shared secret for /internal/* endpoints
  INTERNAL_WEBHOOK_SECRET: z.string().min(16),

  // Axiom structured log shipping (optional — absent in dev)
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),

  // Version info injected at build/deploy time
  GIT_SHA: z.string().default('unknown'),
  APP_VERSION: z.string().default('0.0.0'),
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

/**
 * Resolve the effective public port.
 * PUBLIC_PORT takes precedence over the legacy PORT alias.
 */
export function resolvePublicPort(env: Env): number {
  return env.PUBLIC_PORT ?? env.PORT;
}

/**
 * Parse the ALLOWED_MODELS string into a Set for O(1) lookups.
 */
export function buildAllowedModelsSet(allowedModels: string): Set<string> {
  return new Set(
    allowedModels
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  );
}
