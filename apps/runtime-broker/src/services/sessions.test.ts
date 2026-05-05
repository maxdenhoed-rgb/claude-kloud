import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  _clearRegistryForTests,
  bumpActivity,
  createSession,
  deleteSession,
  getIdleSessions,
  getSession,
  listSessions,
} from './sessions.js';

afterEach(() => {
  _clearRegistryForTests();
});

describe('createSession / getSession', () => {
  it('creates an entry and retrieves it by session_id', () => {
    const entry = createSession('sess-001', 'demo', 'container-abc');

    expect(entry.session_id).toBe('sess-001');
    expect(entry.lab_id).toBe('demo');
    expect(entry.container_id).toBe('container-abc');
    expect(typeof entry.created_at).toBe('number');
    expect(entry.last_active_at).toBe(entry.created_at);

    const fetched = getSession('sess-001');
    expect(fetched).toEqual(entry);
  });

  it('returns undefined for an unknown session_id', () => {
    expect(getSession('does-not-exist')).toBeUndefined();
  });

  it('lists all active sessions', () => {
    createSession('a', 'demo', 'c1');
    createSession('b', 'demo', 'c2');
    expect(listSessions()).toHaveLength(2);
  });
});

describe('deleteSession', () => {
  it('returns true when the session existed and removes it', () => {
    createSession('sess-002', 'demo', 'container-def');
    const result = deleteSession('sess-002');
    expect(result).toBe(true);
    expect(getSession('sess-002')).toBeUndefined();
  });

  it('returns false when the session is already absent (idempotent)', () => {
    const result = deleteSession('never-existed');
    expect(result).toBe(false);
  });

  it('is idempotent: second delete returns false', () => {
    createSession('sess-003', 'demo', 'container-ghi');
    deleteSession('sess-003');
    expect(deleteSession('sess-003')).toBe(false);
  });
});

describe('bumpActivity', () => {
  it('updates last_active_at to a later timestamp', async () => {
    // Use fake timers so we can control Date.now()
    vi.useFakeTimers();
    const start = 1_000_000;
    vi.setSystemTime(start);

    createSession('sess-004', 'demo', 'container-jkl');

    // Advance time by 5 seconds
    vi.setSystemTime(start + 5_000);
    bumpActivity('sess-004');

    const entry = getSession('sess-004');
    expect(entry?.last_active_at).toBe(start + 5_000);

    vi.useRealTimers();
  });

  it('is a no-op for unknown session_id', () => {
    // Should not throw
    expect(() => bumpActivity('ghost')).not.toThrow();
  });
});

describe('getIdleSessions', () => {
  it('detects sessions that have exceeded the idle timeout', () => {
    vi.useFakeTimers();
    const start = 2_000_000;
    vi.setSystemTime(start);

    createSession('active', 'demo', 'c-active');
    createSession('idle', 'demo', 'c-idle');

    // Advance 25 minutes — both sessions are now old
    vi.setSystemTime(start + 25 * 60 * 1_000);

    // Bump only the active one
    bumpActivity('active');

    // With 20-minute timeout, only 'idle' should be returned
    const idleTimeoutMs = 20 * 60 * 1_000;
    const idle = getIdleSessions(idleTimeoutMs);

    expect(idle).toHaveLength(1);
    expect(idle[0]?.session_id).toBe('idle');

    vi.useRealTimers();
  });
});
