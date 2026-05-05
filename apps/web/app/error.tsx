'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wired to Sentry in step 9 per ADR-0005. For now, surface to the console.
    console.error('[claude-kloud] page error', error);
  }, [error]);

  return (
    <main
      role="alert"
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Page failed to render.</h1>
      <p className="text-[var(--color-text-muted)]">
        The server could not produce this page. The error has been logged. Retry once below; if it
        persists, the page is temporarily unavailable.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-[var(--color-text-subtle)]">digest: {error.digest}</p>
      ) : null}
      <div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
