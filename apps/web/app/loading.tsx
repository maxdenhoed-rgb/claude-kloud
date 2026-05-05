export default function Loading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-screen max-w-3xl items-center px-6"
    >
      <p className="font-mono text-sm text-[var(--color-text-muted)]">Loading.</p>
    </main>
  );
}
