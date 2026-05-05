'use client';

import { useEffect, useRef, useState } from 'react';

// Broker URL is configurable so this can point at a remote host in staging.
// Default: local broker started by `docker compose up`.
const BROKER_BASE = process.env.NEXT_PUBLIC_BROKER_URL ?? 'http://localhost:3001';

type Phase = 'idle' | 'starting' | 'attached' | 'error';

interface SessionResponse {
  ok: true;
  data: {
    session_id: string;
    ws_url: string;
  };
}

interface ErrorResponse {
  ok: false;
  error: { code: string; message: string };
}

type BrokerResponse = SessionResponse | ErrorResponse;

export function Terminal() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup across StrictMode double-mount and unmount.
  // These hold the live ws + term instances so the cleanup closure can reach them
  // without capturing a stale value from a prior render cycle.
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);

  async function startLab() {
    setPhase('starting');
    setErrorMessage(null);

    try {
      const res = await fetch(`${BROKER_BASE}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lab_id: 'demo' }),
      });

      const json = (await res.json()) as BrokerResponse;

      if (!json.ok) {
        setErrorMessage(json.error.message);
        setPhase('error');
        return;
      }

      setSessionId(json.data.session_id);
      setWsUrl(json.data.ws_url);
      setPhase('attached');
    } catch {
      setErrorMessage('Could not reach the lab broker. Is docker compose running?');
      setPhase('error');
    }
  }

  async function stopLab() {
    if (!sessionId) return;

    // DELETE with keepalive works on unload; sendBeacon only does POST.
    void fetch(`${BROKER_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      keepalive: true,
    });

    // Tear down WS + terminal before resetting state so the effect cleanup
    // doesn't race with the state transition.
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;

    setSessionId(null);
    setWsUrl(null);
    setPhase('idle');
  }

  // Mount xterm once phase flips to 'attached' and wsUrl is known.
  // The `disposed` flag guards against React 19 StrictMode double-mount:
  // the first cleanup sets disposed=true, preventing the stale async closure
  // from opening a WebSocket after the second mount has already started.
  useEffect(() => {
    if (phase !== 'attached' || !sessionId || !wsUrl) return;

    let disposed = false;

    void (async () => {
      const [{ Terminal: XTerm }, { AttachAddon }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-attach'),
        import('@xterm/addon-fit'),
      ]);
      // Dynamic CSS import keeps xterm styles out of the SSR bundle.
      await import('@xterm/xterm/css/xterm.css');

      if (disposed) return;

      const term = new XTerm({
        fontFamily: 'ui-monospace, "JetBrains Mono", "IBM Plex Mono", monospace',
        fontSize: 13,
        cursorBlink: true,
        theme: {
          background: '#0b0d10',
          foreground: '#ededed',
          cursor: '#d97757',
          selectionBackground: 'rgba(217,119,87,0.3)',
        },
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      termRef.current = term;

      if (terminalRef.current) {
        term.open(terminalRef.current);
        fit.fit();
      }

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        term.loadAddon(new AttachAddon(ws, { bidirectional: true }));
        term.focus();
      };

      ws.onerror = () => {
        term.write('\r\n\x1b[31mWebSocket connection failed.\x1b[0m\r\n');
      };

      ws.onclose = () => {
        term.write('\r\n\x1b[33mSession closed.\x1b[0m\r\n');
      };

      // v1 limitation: visual-only resize. The container PTY dimensions are not
      // updated when the browser window resizes, so long lines won't re-wrap
      // correctly. A future iteration can POST /sessions/:id/resize with
      // { cols, rows } from fit.proposeDimensions() to fix this.
      const handleResize = () => fit.fit();
      window.addEventListener('resize', handleResize);

      // Store cleanup in a local variable so the return closure can reference it.
      const cleanup = () => {
        window.removeEventListener('resize', handleResize);
        ws.close();
        wsRef.current = null;
        term.dispose();
        termRef.current = null;
      };

      // Attach cleanup to a ref so stopLab() can trigger it synchronously.
      // We use the ws onclose to trigger cleanup only when the effect itself
      // is destroyed, not on every ws close event.
      return cleanup;
    })();

    return () => {
      disposed = true;
      // Close existing WS + dispose terminal on StrictMode remount or unmount.
      wsRef.current?.close();
      wsRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [phase, sessionId, wsUrl]);

  // Best-effort DELETE on page unload.
  useEffect(() => {
    if (!sessionId) return;
    const handleUnload = () => {
      void fetch(`${BROKER_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId]);

  return (
    <div className="flex flex-col gap-3">
      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded border border-[var(--color-status-fail)] bg-[var(--color-status-fail)]/10 px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {errorMessage}
        </div>
      )}

      {phase === 'idle' || phase === 'error' ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void startLab()}
            className="w-fit rounded border border-[var(--color-border)] bg-[#1a1d20] px-3 py-1.5 text-sm text-[var(--color-text)] transition hover:bg-[#22262a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            Start lab
          </button>
          <p className="text-xs text-[var(--color-text-subtle)]">
            (boots a sandbox container in ~5s)
          </p>
        </div>
      ) : phase === 'starting' ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner />
          Spinning up container...
        </div>
      ) : null}

      {/* Terminal — always in DOM when attached or error so the ref is stable */}
      {(phase === 'attached' || phase === 'error') && (
        <>
          <div
            ref={terminalRef}
            aria-label="Lab terminal"
            className="h-[600px] w-full overflow-hidden rounded bg-[#0b0d10]"
          />
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-subtle)]">
            <span className="font-mono">
              session_id: <span className="text-[var(--color-text-muted)]">{sessionId}</span>
            </span>
            <button
              type="button"
              onClick={() => void stopLab()}
              className="rounded border border-[var(--color-border)] bg-[#1a1d20] px-3 py-1 text-xs text-[var(--color-text)] transition hover:bg-[#22262a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            >
              Stop lab
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin text-[var(--color-text-muted)]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
