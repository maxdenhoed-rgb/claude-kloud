import { proxyCallLog } from '@claudekloud/db';
import type { DbClient, NewProxyCallLog } from '@claudekloud/db';

const REDACTED = '[REDACTED]';

/**
 * Scrub the master Anthropic API key from a request headers object.
 * Mutates a shallow copy — never the original.
 */
export function redactAuthHeader(headers: Record<string, string>): Record<string, string> {
  const copy = { ...headers };
  for (const key of Object.keys(copy)) {
    if (key.toLowerCase() === 'x-api-key' || key.toLowerCase() === 'authorization') {
      copy[key] = REDACTED;
    }
  }
  return copy;
}

/**
 * Redact the Authorization / x-api-key header from an arbitrary JSONB request
 * object before writing it to the database.
 */
export function redactRequestBody(body: unknown): unknown {
  if (body === null || typeof body !== 'object') return body;

  const obj = body as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };

  if ('headers' in result && result['headers'] !== null && typeof result['headers'] === 'object') {
    result['headers'] = redactAuthHeader(result['headers'] as Record<string, string>);
  }

  return result;
}

export interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ToolUseBlock {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
}

/**
 * Write one row to proxy_call_log.
 * This function is called once at message_stop (or on stream abort).
 */
export async function writeCallLog(db: DbClient, row: NewProxyCallLog): Promise<void> {
  await db.insert(proxyCallLog).values(row);
}

/**
 * Parse a single SSE data line from the Anthropic streaming response.
 * Returns null for lines that don't carry token usage information.
 */
export function parseAnthropicSseLine(line: string): {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
} | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  if (raw === '[DONE]') return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      return parsed as { type: string; data: Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract usage numbers from a message_delta or message_start event payload.
 * Anthropic's streaming format nests usage differently per event type:
 *   - message_start  → event.message.usage
 *   - message_delta  → event.usage
 */
export function extractUsageFromEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: Record<string, any>,
  accumulator: UsageAccumulator,
): void {
  const usage = event['usage'] ?? event['message']?.['usage'] ?? null;

  if (usage === null || typeof usage !== 'object') return;

  if (typeof usage['input_tokens'] === 'number') {
    accumulator.inputTokens += usage['input_tokens'] as number;
  }

  if (typeof usage['output_tokens'] === 'number') {
    accumulator.outputTokens += usage['output_tokens'] as number;
  }

  if (typeof usage['cache_read_input_tokens'] === 'number') {
    accumulator.cacheReadInputTokens += usage['cache_read_input_tokens'] as number;
  }

  if (typeof usage['cache_creation_input_tokens'] === 'number') {
    accumulator.cacheCreationInputTokens += usage['cache_creation_input_tokens'] as number;
  }
}
