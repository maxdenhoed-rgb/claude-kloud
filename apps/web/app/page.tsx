import { SignupForm } from '@/components/signup-form';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <header className="mb-16 flex items-center justify-between">
        <span className="font-mono text-sm tracking-tight text-[var(--color-text)]">
          claude-kloud
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
          $40/mo <span className="text-[var(--color-text-subtle)]">(coming soon)</span>
        </span>
      </header>

      <section aria-labelledby="hero-heading" className="mb-12">
        <h1
          id="hero-heading"
          className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl"
        >
          Practice for the Claude Certified Architect exam.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-7 text-[var(--color-text-muted)]">
          Hands-on labs against the real Claude API. Scenario-based, auto-graded, weighted to the
          actual CCA-F domain split. Built for architects who already know the patterns and need the
          reps. Anthropic Academy teaches you Claude. We make sure you can do Claude under pressure.
        </p>
      </section>

      <section aria-labelledby="contents-heading" className="mb-12">
        <h2
          id="contents-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
        >
          What is in the platform
        </h2>
        <ul className="space-y-3 text-[var(--color-text)]">
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
            />
            <span>
              50 hands-on labs across the five CCA-F domains, weighted to the real exam split
              (Agentic Architecture 27%, Claude Code Workflows 20%, Prompt Engineering 20%, Tool
              Design &amp; MCP 18%, Context Management 15%).
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
            />
            <span>
              Per-session sandboxes with a live editor, terminal, and brokered Claude API access.
              Auto-graded against declarative validation rules, not vibes.
            </span>
          </li>
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]"
            />
            <span>
              Four mock exams that match the CCA-F format — 60 questions, 120 minutes, scaled
              720-pass scoring, per-domain breakdown so you know what to fix before sitting the real
              one.
            </span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="signup-heading" className="mb-16">
        <h2 id="signup-heading" className="mb-3 text-base font-semibold">
          Tell us where to send the launch notice.
        </h2>
        <p className="mb-5 text-sm text-[var(--color-text-muted)]">
          One email when the first track ships. No newsletter. Unsubscribe is one click.
        </p>
        <SignupForm />
      </section>

      <footer className="mt-auto border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-text-subtle)]">
        <p>
          Independent prep for the CCA-F exam. Not affiliated with Anthropic. Trademarks belong to
          their owners.
        </p>
      </footer>
    </main>
  );
}
