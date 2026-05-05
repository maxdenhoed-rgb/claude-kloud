import { Terminal } from './Terminal';

export const metadata = {
  title: 'Demo lab — claude-kloud',
  description:
    'Spawn a sandbox container and talk to Claude through the proxy. Validates the end-to-end lab runtime locally.',
};

export default function DemoLabPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <h1 className="text-base font-semibold text-[var(--color-text)]">Demo lab</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Spawn a sandbox container, talk to Claude through the proxy.
        </p>
      </header>

      <Terminal />
    </main>
  );
}
