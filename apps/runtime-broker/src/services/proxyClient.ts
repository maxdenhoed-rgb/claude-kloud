import { getEnv } from '../lib/env.js';
import { getLogger } from '../lib/logger.js';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 250;

export interface ProxySessionResponse {
  token: string;
  expires_at: string;
}

/**
 * Call the proxy's POST /internal/sessions endpoint to mint a session JWT.
 * Retries up to MAX_ATTEMPTS times with linear backoff on network errors.
 * Throws if the proxy returns a non-ok response or all attempts fail.
 */
export async function mintSessionToken(
  userId: string,
  labId: string,
  sessionId: string,
  budgetTier: 'standard' | 'extended' | 'long-context',
): Promise<ProxySessionResponse> {
  const env = getEnv();
  const logger = getLogger();
  const url = `${env.PROXY_INTERNAL_URL}/internal/sessions`;

  const body = JSON.stringify({
    user_id: userId,
    lab_id: labId,
    session_id: sessionId,
    budget_tier: budgetTier,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': env.INTERNAL_WEBHOOK_SECRET,
        },
        body,
      });

      if (!res.ok) {
        // Surface proxy error as a thrown Error so callers can distinguish
        const text = await res.text().catch(() => '');
        throw new Error(`Proxy returned HTTP ${res.status}: ${text}`);
      }

      // The proxy wraps in { ok: true, data: { token, expires_at } }
      const json = (await res.json()) as {
        ok: boolean;
        data?: ProxySessionResponse;
        error?: { code: string; message: string };
      };

      if (!json.ok || !json.data) {
        throw new Error(`Proxy response not ok: ${json.error?.message ?? 'unknown error'}`);
      }

      return json.data;
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      logger.warn({ attempt, url, message }, 'proxy request failed');

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS * attempt);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Proxy unavailable after ${MAX_ATTEMPTS} attempts: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
