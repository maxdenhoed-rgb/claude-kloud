// In-memory signup store. Module-scoped, lives for the life of the server process.
// TODO: persist to Postgres (step 2). When DATABASE_URL is set, swap this for a Drizzle-backed
// implementation behind the same `addSignup` interface.

const signups = new Set<string>();

export function addSignup(email: string): { added: boolean; total: number } {
  const normalized = email.trim().toLowerCase();
  const before = signups.size;
  signups.add(normalized);
  return { added: signups.size > before, total: signups.size };
}

export function signupCount(): number {
  return signups.size;
}
