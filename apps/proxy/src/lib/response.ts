import type { Context } from 'hono';

/**
 * Standard success envelope: { ok: true, data }.
 * Used by all non-streaming endpoints per CLAUDE.md.
 */
export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ ok: true, data }, status);
}

/**
 * Standard error envelope: { ok: false, error: { code, message, data? } }.
 * Used by all non-streaming endpoints per CLAUDE.md.
 */
export function err(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503,
  code: string,
  message: string,
  data?: unknown,
) {
  const body: {
    ok: false;
    error: { code: string; message: string; data?: unknown };
  } = {
    ok: false,
    error: { code, message },
  };
  if (data !== undefined) {
    body.error.data = data;
  }
  return c.json(body, status);
}
