'use client';

import { useState, type FormEvent } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function SignupForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();

    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { email: string } }
        | { ok: false; error: { code: string; message: string } };

      if (json.ok) {
        setStatus({ kind: 'success' });
        form.reset();
      } else {
        setStatus({ kind: 'error', message: json.error.message });
      }
    } catch {
      setStatus({
        kind: 'error',
        message: 'Network failure. Check your connection and retry.',
      });
    }
  }

  const submitting = status.kind === 'submitting';

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@domain.com"
        aria-describedby="signup-status"
        disabled={submitting}
        className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting' : 'Notify me'}
      </button>
      <p
        id="signup-status"
        role="status"
        aria-live="polite"
        className="basis-full text-sm text-[var(--color-text-muted)] sm:basis-auto"
      >
        {status.kind === 'success'
          ? 'Recorded. We will email when the first track is live.'
          : status.kind === 'error'
            ? status.message
            : ''}
      </p>
    </form>
  );
}
