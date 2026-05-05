/**
 * In-memory session registry.
 * Tracks (session_id -> SessionEntry) for the lifetime of the broker process.
 * No database — broker is local-only and ephemeral.
 */

export interface SessionEntry {
  session_id: string;
  lab_id: string;
  container_id: string;
  created_at: number;
  last_active_at: number;
}

const registry = new Map<string, SessionEntry>();

/**
 * Register a new session after the container is booted.
 */
export function createSession(
  session_id: string,
  lab_id: string,
  container_id: string,
): SessionEntry {
  const now = Date.now();
  const entry: SessionEntry = {
    session_id,
    lab_id,
    container_id,
    created_at: now,
    last_active_at: now,
  };
  registry.set(session_id, entry);
  return entry;
}

/**
 * Look up a session by ID. Returns undefined if not found.
 */
export function getSession(session_id: string): SessionEntry | undefined {
  return registry.get(session_id);
}

/**
 * Remove a session from the registry.
 * Returns true if the entry existed, false if it was already absent (idempotent).
 */
export function deleteSession(session_id: string): boolean {
  return registry.delete(session_id);
}

/**
 * Return all active sessions (snapshot of registry values).
 */
export function listSessions(): SessionEntry[] {
  return Array.from(registry.values());
}

/**
 * Bump last_active_at for a session.
 * No-op if the session does not exist.
 */
export function bumpActivity(session_id: string): void {
  const entry = registry.get(session_id);
  if (entry) {
    entry.last_active_at = Date.now();
  }
}

/**
 * Return sessions whose last_active_at is older than idleTimeoutMs.
 */
export function getIdleSessions(idleTimeoutMs: number): SessionEntry[] {
  const cutoff = Date.now() - idleTimeoutMs;
  return Array.from(registry.values()).filter((e) => e.last_active_at < cutoff);
}

/**
 * Exposed for testing — clears the entire registry.
 */
export function _clearRegistryForTests(): void {
  registry.clear();
}
