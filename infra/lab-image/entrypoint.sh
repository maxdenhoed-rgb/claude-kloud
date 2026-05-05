#!/bin/sh
# entrypoint.sh — ClaudeKloud lab container entrypoint
#
# Responsibilities:
#   1. Validate that the broker injected ANTHROPIC_API_KEY.
#   2. Hard-wire ANTHROPIC_BASE_URL to our proxy (containers must not reach
#      api.anthropic.com directly; egress rules enforce this at the network
#      layer, but we set the env var so the SDK never tries the real endpoint).
#   3. Write the ready sentinel so the HEALTHCHECK passes.
#   4. Exec the PTY launcher (or the command passed by the broker).
#
# Environment contract (all injected by the runtime-broker at machine boot):
#   ANTHROPIC_API_KEY      — session-scoped proxy key (required, non-empty)
#   ANTHROPIC_BASE_URL     — overridden below; broker may also set it
#   LAB_ID                 — e.g. "1.3-tool-use-error-handling" (informational)
#   LAB_SESSION_ID         — UUID for this session (informational, used in logs)
#   LAB_TOKEN_BUDGET_INPUT — input token cap for this session  (informational)
#   LAB_TOKEN_BUDGET_OUTPUT— output token cap for this session (informational)
#
# The PTY launcher is whatever $@ resolves to.  The broker passes the
# session-specific command when calling `fly machines run`.  For local dev,
# exec /bin/bash as a fallback.

set -eu

# ---------------------------------------------------------------------------
# 1. Guard: ANTHROPIC_API_KEY must be present and non-empty.
# ---------------------------------------------------------------------------
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo '{"ok":false,"error":{"code":"MISSING_API_KEY","message":"ANTHROPIC_API_KEY is not set. The runtime-broker must inject it at machine boot."}}' >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Force all SDK traffic through the proxy.
#    Default to the production proxy; the broker may override this at boot
#    (e.g. ANTHROPIC_BASE_URL=http://host.docker.internal:8080 for local dev).
#    The network-layer egress rules block *.anthropic.com in production, so
#    this is belt-and-suspenders for the Fly path. For local dev the broker
#    sets the host.docker.internal URL explicitly; respect it.
# ---------------------------------------------------------------------------
: "${ANTHROPIC_BASE_URL:=https://proxy.claudekloud.dev}"
export ANTHROPIC_BASE_URL

# Ensure PATH includes our Python venv and Node bins.
export PATH="/opt/pyenv/bin:/usr/local/bin:${PATH}"

# ---------------------------------------------------------------------------
# 3. Write the ready sentinel (HEALTHCHECK reads this file).
# ---------------------------------------------------------------------------
touch /tmp/.lab-ready

# ---------------------------------------------------------------------------
# 4. Exec the supplied command, or keep PID 1 alive for docker exec sessions.
#    When the broker passes no command (local dev / demo) we run sleep infinity
#    so the container stays up and `docker exec -it <id> /bin/bash` works.
# ---------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    exec sleep infinity
else
    exec "$@"
fi
