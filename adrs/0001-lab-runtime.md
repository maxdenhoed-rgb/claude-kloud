# ADR-0001 — Lab Runtime

**Status:** Accepted
**Date:** 2026-05-05
**Decision-maker:** Founding team

## Context

Each lab needs to give the learner a sandbox with: a code editor, a terminal, the Anthropic SDK pre-installed, and access to a real Claude API key. Calls must reach actual Claude, because credibility depends on the labs being real — not mocked. Cost must be controlled, because we charge $40/month and our gross margin disappears if a learner can burn through unbounded API spend in a 45-minute lab.

## Decision

Per-session ephemeral Docker containers, orchestrated on Fly.io (or AWS ECS Fargate as a fallback), behind an in-house **API proxy** that brokers all Claude API traffic.

- Each learner session gets a fresh container with the Anthropic Python and TypeScript SDKs pre-installed, scenario starter files, and an environment variable `ANTHROPIC_API_KEY` set to a **session-scoped proxy key**.
- The SDK calls do not go directly to `api.anthropic.com`. They go to our proxy, which authenticates the session, enforces per-session quotas, logs the request/response for validation, and forwards to Anthropic using our master key.
- Containers spin down after 20 minutes idle or 90 minutes total session length. Shutdown is graceful — workspace state is snapshotted to S3 so the learner can resume.
- Sandbox specs: 1 vCPU, 1 GB RAM, 5 GB ephemeral disk. More than enough for SDK calls and small agent loops.

## Why

- **Real API** is the credibility wedge. Simulators feel like simulators — Marcus would smell it in 30 seconds.
- **Proxy** gives us cost control (per-session caps in tokens), validation (we see every request and response), and abuse detection (someone trying to use the lab as a free Claude proxy gets cut off).
- **Containers** give us a clean reset per session, real terminal access via xterm.js + WebSocket-to-PTY, and the security boundary we'd want anyway.
- **Fly.io** is cheap, fast to spin up (sub-3 seconds), and good at the per-user-container pattern. ECS Fargate is the enterprise fallback if we ever need it.

## Alternatives considered

- **Bring-your-own-key (BYOK).** Rejected. Raises the friction for Marcus to start lab #1 and makes server-side validation impossible. We can't grade what we can't see.
- **Pure browser-side Pyodide / Web Worker.** Rejected. Limits to Python, no realistic terminal, can't run MCP servers, and the validation surface shrinks to "we trust the client."
- **Shared sandbox with cookie-based isolation.** Rejected. Shared kernel + cookie-trust means one bad lab takes everyone down, and contamination between learners is a real risk.
- **GitHub Codespaces / Replit.** Rejected. We'd be reselling someone else's product, the API key story is awkward, and we lose the validation hook.

## Cost model

- Average lab session: ~30 minutes, ~50K input tokens + ~20K output tokens against `claude-sonnet-4-7`. ≈ $0.20 per lab at list price.
- Average learner: 30 lab sessions/month + 2 mock exams (no API cost) ≈ $6 of Claude API per month.
- Container compute (Fly.io): ≈ $2 of compute per learner per month.
- Gross margin at $40/mo: ≈ $32, ≈ 80%.

If a learner blows past 100 lab sessions in a month, we throttle (not cut off) and email them. Power users are a feature, not a bug, until they're a margin disaster.

## Consequences

- We need a proxy service from day one. It's a small Node service, not a deep build.
- We need observability per session (token spend, error rate, validation pass/fail). Probably fine with Sentry + structured logs initially.
- We are responsible for keeping the SDK in the container image up-to-date with Anthropic releases. CI rebuilds the image on every Anthropic SDK release.
- Learners cannot use models we don't allow. The proxy enforces an allowlist (`claude-sonnet-4-7`, `claude-opus-4-7`, `claude-haiku-4-5`). They can't accidentally cost us $50 by switching to Opus on every call.

## Open follow-ups

- Decide token cap per session (proposed: 200K input, 50K output as default; bumpable per lab).
- Decide retry / circuit-breaker behavior in the proxy on Anthropic 429s and 5xxs.
- Decide whether the proxy has a "Claude version pinning" feature so labs don't break when Anthropic releases a new model.
