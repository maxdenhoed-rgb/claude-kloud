import type { DbClient } from '@claudekloud/db';
import { Hono } from 'hono';

import { getEnv, buildAllowedModelsSet } from '../lib/env.js';
import { getLogger } from '../lib/logger.js';
import { err } from '../lib/response.js';
import { sessionAuth } from '../middleware/sessionAuth.js';
import {
  getSessionBudget,
  checkBudget,
  incrementSessionTokens,
  ensureSessionBudget,
} from '../services/budget.js';
import {
  redactRequestBody,
  writeCallLog,
  extractUsageFromEvent,
  parseAnthropicSseLine,
} from '../services/callLog.js';

interface MessagesDeps {
  db: DbClient;
}

export function createMessagesRouter(deps: MessagesDeps) {
  const router = new Hono();

  /**
   * POST /v1/messages
   *
   * Authenticates the session token, enforces the model allowlist, checks the
   * token budget, then forwards the request to api.anthropic.com.
   *
   * Streaming responses (stream: true) are piped through as-is so that the
   * Anthropic SDK in the lab container receives the exact SSE wire format.
   * The proxy accumulates usage from message_delta events and writes the log
   * row at message_stop.
   *
   * IMPORTANT: This is the ONE endpoint that does NOT wrap the response in
   * { ok, data } — the Anthropic SDK expects the raw Anthropic wire format.
   * This exception is documented in apps/proxy/README.md (section G11).
   */
  router.post('/v1/messages', sessionAuth, async (c) => {
    const env = getEnv();
    const logger = getLogger();
    const allowedModels = buildAllowedModelsSet(env.ALLOWED_MODELS);

    const claims = c.get('sessionToken');
    const requestId = crypto.randomUUID();
    const startedAt = new Date();

    // Parse request body
    let requestBody: Record<string, unknown>;
    try {
      requestBody = await c.req.json<Record<string, unknown>>();
    } catch {
      return err(c, 400, 'INVALID_BODY', 'Request body must be valid JSON');
    }

    // Validate model
    const model = requestBody['model'];
    if (typeof model !== 'string' || !allowedModels.has(model)) {
      return err(
        c,
        400,
        'MODEL_NOT_ALLOWED',
        `Model "${String(model)}" is not in the allowlist. Allowed: ${[...allowedModels].join(', ')}`,
      );
    }

    // Ensure budget row exists (idempotent), then check budget
    const tokenExp = new Date(claims.exp * 1000);
    try {
      await ensureSessionBudget(deps.db, claims.sid, claims.budget_tier, tokenExp);
    } catch (e) {
      logger.error({ err: e, sessionId: claims.sid }, 'failed to ensure session budget');
      return err(c, 500, 'DB_ERROR', 'Failed to initialize session budget');
    }

    const budget = await getSessionBudget(deps.db, claims.sid);
    if (!budget) {
      return err(c, 500, 'BUDGET_NOT_FOUND', 'Session budget record not found');
    }

    const budgetCheck = checkBudget(budget);
    if (budgetCheck.exceeded) {
      return err(
        c,
        429,
        'BUDGET_EXCEEDED',
        `Session token budget exceeded (${budgetCheck.field} tokens)`,
        {
          remaining_input: budgetCheck.remainingInput,
          remaining_output: budgetCheck.remainingOutput,
          input_cap: budget.inputCap,
          output_cap: budget.outputCap,
        },
      );
    }

    // Build upstream request headers — strip the session token, inject master key
    const upstreamHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': c.req.header('anthropic-version') ?? '2023-06-01',
    };

    // Forward beta headers if present
    const betaHeader = c.req.header('anthropic-beta');
    if (betaHeader) {
      upstreamHeaders['anthropic-beta'] = betaHeader;
    }

    const upstreamUrl = `${env.ANTHROPIC_API_URL}/v1/messages`;
    const bodyStr = JSON.stringify(requestBody);

    let upstreamResponse: globalThis.Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: bodyStr,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upstream fetch failed';
      logger.error({ err: e, sessionId: claims.sid }, 'upstream fetch error');

      // Log failed call
      await writeCallLog(deps.db, {
        sessionId: claims.sid,
        userId: claims.sub,
        labId: claims.lab,
        requestId,
        startedAt,
        finishedAt: new Date(),
        model,
        request: redactRequestBody({ headers: upstreamHeaders, body: requestBody }),
        response: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        stopReason: null,
        toolUses: [],
        retryCount: 0,
        finalStatus: 0,
        isPartial: true,
        error: { message, type: 'upstream_fetch_error' },
      }).catch((dbErr) => {
        logger.error({ err: dbErr }, 'failed to write call log after upstream error');
      });

      return err(c, 503, 'UPSTREAM_ERROR', message);
    }

    const isStreaming = requestBody['stream'] === true;

    if (!isStreaming) {
      // Non-streaming path: collect the full response, then log and return
      const responseBody = await upstreamResponse.text();
      const finishedAt = new Date();

      let parsedResponse: Record<string, unknown> | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadInputTokens = 0;
      let cacheCreationInputTokens = 0;
      let stopReason: string | null = null;
      const toolUses: unknown[] = [];

      try {
        parsedResponse = JSON.parse(responseBody) as Record<string, unknown>;

        const usage = parsedResponse['usage'];
        if (usage !== null && typeof usage === 'object') {
          const u = usage as Record<string, unknown>;
          if (typeof u['input_tokens'] === 'number') inputTokens = u['input_tokens'];
          if (typeof u['output_tokens'] === 'number') outputTokens = u['output_tokens'];
          if (typeof u['cache_read_input_tokens'] === 'number')
            cacheReadInputTokens = u['cache_read_input_tokens'];
          if (typeof u['cache_creation_input_tokens'] === 'number')
            cacheCreationInputTokens = u['cache_creation_input_tokens'];
        }

        if (typeof parsedResponse['stop_reason'] === 'string') {
          stopReason = parsedResponse['stop_reason'];
        }

        const content = parsedResponse['content'];
        if (Array.isArray(content)) {
          for (const block of content) {
            if (
              block !== null &&
              typeof block === 'object' &&
              (block as Record<string, unknown>)['type'] === 'tool_use'
            ) {
              toolUses.push(block);
            }
          }
        }
      } catch {
        // Response wasn't valid JSON — log as-is
      }

      // Write log row
      await writeCallLog(deps.db, {
        sessionId: claims.sid,
        userId: claims.sub,
        labId: claims.lab,
        requestId,
        startedAt,
        finishedAt,
        model,
        request: redactRequestBody({ headers: upstreamHeaders, body: requestBody }),
        response: parsedResponse,
        inputTokens,
        outputTokens,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        stopReason,
        toolUses,
        retryCount: 0,
        finalStatus: upstreamResponse.status,
        isPartial: false,
        error: null,
      }).catch((dbErr) => {
        logger.error({ err: dbErr }, 'failed to write call log');
      });

      // Update budget
      if (upstreamResponse.ok && (inputTokens > 0 || outputTokens > 0)) {
        const updated = await incrementSessionTokens(
          deps.db,
          claims.sid,
          inputTokens,
          outputTokens,
        );
        if (updated) {
          c.header(
            'X-Budget-Remaining',
            `input=${updated.inputCap - updated.inputTokensUsed};output=${updated.outputCap - updated.outputTokensUsed}`,
          );
        }
      }

      // Return the raw Anthropic response
      return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: {
          'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json',
          'x-request-id': requestId,
        },
      });
    }

    // ---------------------------------------------------------------------------
    // Streaming path — pipe SSE through, accumulate usage, log at message_stop
    // ---------------------------------------------------------------------------
    const accum = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    };
    const toolUses: unknown[] = [];
    let stopReason: string | null = null;
    let streamAborted = false;
    let finalStatus = upstreamResponse.status;

    const upstreamBody = upstreamResponse.body;

    const transformedStream = new ReadableStream({
      async start(controller) {
        if (!upstreamBody) {
          controller.close();
          return;
        }

        const reader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete SSE lines
            const lines = buffer.split('\n');
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) {
                controller.enqueue(new TextEncoder().encode(line + '\n'));
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const event = parseAnthropicSseLine(trimmed);
                if (event) {
                  extractUsageFromEvent(event, accum);

                  if (event.type === 'message_stop') {
                    finalStatus = upstreamResponse.status;
                  }

                  if (event.type === 'message_delta') {
                    const delta = event as Record<string, unknown>;
                    if (typeof delta['stop_reason'] === 'string') {
                      stopReason = delta['stop_reason'];
                    }
                    // Also check nested delta
                    const nested = delta['delta'];
                    if (
                      nested !== null &&
                      typeof nested === 'object' &&
                      typeof (nested as Record<string, unknown>)['stop_reason'] === 'string'
                    ) {
                      stopReason = (nested as Record<string, unknown>)['stop_reason'] as string;
                    }
                  }

                  if (event.type === 'content_block_stop') {
                    // Tool use blocks are collected in content_block_start
                  }

                  if (event.type === 'content_block_start') {
                    const block = (event as Record<string, unknown>)['content_block'];
                    if (
                      block !== null &&
                      typeof block === 'object' &&
                      (block as Record<string, unknown>)['type'] === 'tool_use'
                    ) {
                      toolUses.push(block);
                    }
                  }
                }
              }

              controller.enqueue(new TextEncoder().encode(line + '\n'));
            }
          }

          // Flush remaining buffer
          if (buffer) {
            controller.enqueue(new TextEncoder().encode(buffer));
          }
        } catch (streamErr) {
          streamAborted = true;
          logger.warn({ err: streamErr, sessionId: claims.sid }, 'stream aborted');
        } finally {
          controller.close();

          const finishedAt = new Date();

          // Write call log
          writeCallLog(deps.db, {
            sessionId: claims.sid,
            userId: claims.sub,
            labId: claims.lab,
            requestId,
            startedAt,
            finishedAt,
            model,
            request: redactRequestBody({ headers: upstreamHeaders, body: requestBody }),
            response: null, // streaming — no assembled body
            inputTokens: accum.inputTokens,
            outputTokens: accum.outputTokens,
            cacheReadInputTokens: accum.cacheReadInputTokens,
            cacheCreationInputTokens: accum.cacheCreationInputTokens,
            stopReason,
            toolUses,
            retryCount: 0,
            finalStatus,
            isPartial: streamAborted,
            error: streamAborted ? { type: 'stream_aborted' } : null,
          }).catch((dbErr) => {
            logger.error({ err: dbErr }, 'failed to write stream call log');
          });

          // Update budget counters
          if (accum.inputTokens > 0 || accum.outputTokens > 0) {
            incrementSessionTokens(
              deps.db,
              claims.sid,
              accum.inputTokens,
              accum.outputTokens,
            ).catch((dbErr) => {
              logger.error({ err: dbErr }, 'failed to update session budget after stream');
            });
          }
        }
      },
    });

    // Copy relevant Anthropic response headers through
    const responseHeaders: Record<string, string> = {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-request-id': requestId,
    };

    // Forward rate limit headers from Anthropic for observability
    for (const header of [
      'anthropic-ratelimit-requests-limit',
      'anthropic-ratelimit-requests-remaining',
      'anthropic-ratelimit-tokens-limit',
      'anthropic-ratelimit-tokens-remaining',
      'request-id',
    ]) {
      const val = upstreamResponse.headers.get(header);
      if (val) responseHeaders[header] = val;
    }

    return new Response(transformedStream, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  });

  return router;
}
