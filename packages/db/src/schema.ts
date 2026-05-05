import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// proxy_call_log
// Every forwarded Claude API call writes one row here.
// This is the read contract for the validator (ADR-0002) and cost-monitoring
// SQL views (infra/cost-monitoring/README.md).  Do not rename or remove
// columns without a matching migration.
// ---------------------------------------------------------------------------
export const proxyCallLog = pgTable(
  'proxy_call_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: uuid('session_id').notNull(),
    userId: text('user_id').notNull(),
    labId: text('lab_id').notNull(),
    requestId: text('request_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    model: text('model'),
    // master Authorization header value is replaced with "[REDACTED]" before insert
    request: jsonb('request'),
    // final assembled response body, or null when the stream aborted
    response: jsonb('response'),
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    cacheReadInputTokens: integer('cache_read_input_tokens').default(0),
    cacheCreationInputTokens: integer('cache_creation_input_tokens').default(0),
    stopReason: text('stop_reason'),
    toolUses: jsonb('tool_uses').default(sql`'[]'::jsonb`),
    retryCount: integer('retry_count').default(0),
    finalStatus: integer('final_status'),
    isPartial: boolean('is_partial').default(false),
    error: jsonb('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('proxy_call_log_session_id_idx').on(table.sessionId),
    index('proxy_call_log_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('proxy_call_log_lab_id_created_at_idx').on(table.labId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// session_budget
// Tracks token consumption per session for enforcement.
// Using Postgres (not Redis) for v1 — see apps/proxy/README.md for rationale.
// ---------------------------------------------------------------------------
export const sessionBudget = pgTable('session_budget', {
  sessionId: uuid('session_id').primaryKey(),
  inputTokensUsed: integer('input_tokens_used').notNull().default(0),
  outputTokensUsed: integer('output_tokens_used').notNull().default(0),
  inputCap: integer('input_cap').notNull(),
  outputCap: integer('output_cap').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// lab_image_releases
// Written by POST /internal/lab-image-release (called by the lab-image CI
// workflow after each image build + sign).  The broker reads this table to
// know the current canonical image digest without polling the registry.
// ---------------------------------------------------------------------------
export const labImageReleases = pgTable(
  'lab_image_releases',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    imageRef: text('image_ref').notNull(),
    digest: text('digest').notNull(),
    gitSha: text('git_sha').notNull(),
    triggeredBy: text('triggered_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('lab_image_releases_digest_unique').on(table.digest)],
);

// ---------------------------------------------------------------------------
// model_pricing
// Updated manually when Anthropic changes rates.
// Used by the session_cost materialized view (see infra/cost-monitoring/).
// ---------------------------------------------------------------------------
export const modelPricing = pgTable('model_pricing', {
  model: text('model').primaryKey(),
  inputUsdPerMtok: text('input_usd_per_mtok').notNull(),
  outputUsdPerMtok: text('output_usd_per_mtok').notNull(),
  cacheReadUsdPerMtok: text('cache_read_usd_per_mtok').notNull().default('0'),
  cacheWriteUsdPerMtok: text('cache_write_usd_per_mtok').notNull().default('0'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  notes: text('notes'),
});

// ---------------------------------------------------------------------------
// Type exports for use in the proxy service
// ---------------------------------------------------------------------------
export type ProxyCallLog = typeof proxyCallLog.$inferSelect;
export type NewProxyCallLog = typeof proxyCallLog.$inferInsert;
export type SessionBudget = typeof sessionBudget.$inferSelect;
export type NewSessionBudget = typeof sessionBudget.$inferInsert;
export type LabImageRelease = typeof labImageReleases.$inferSelect;
export type NewLabImageRelease = typeof labImageReleases.$inferInsert;
