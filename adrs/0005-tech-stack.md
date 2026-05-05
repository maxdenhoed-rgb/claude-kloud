# ADR-0005 — Tech Stack

**Status:** Accepted
**Date:** 2026-05-05

## Context

We're a small team. Probably one founding engineer + Xebia time. We need a stack that ships a credible MVP in 8–12 weeks, scales to a few thousand paying users without re-platforming, and uses tools that one engineer can hold in their head end-to-end. We do not optimize for "what would survive a Series A."

## Decision

| Layer             | Choice                                                              | Why                                                                                      |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend          | Next.js 15 (App Router) + React + TypeScript                        | Server components for the dashboard, RSC for the marketing pages, vast ecosystem.        |
| Styling           | Tailwind CSS + shadcn/ui                                            | Density-first design (see Identity doc), zero runtime, copy-paste components.            |
| Editor            | Monaco                                                              | The same editor as VS Code. Marcus already knows it.                                     |
| Terminal          | xterm.js + WebSocket → PTY in container                             | Standard pattern, battle-tested, what KodeKloud uses.                                    |
| Backend           | Node.js + Hono                                                      | Hono is small, fast, edge-friendly, and TS-native. NestJS is overkill.                   |
| API proxy         | Separate Hono service                                               | Isolated concern. See ADR-0001.                                                          |
| Validation engine | Separate Node service that reads `validate.yml`, queries proxy logs | See ADR-0002.                                                                            |
| Database          | Postgres (Neon or Supabase)                                         | Boring. Perfect.                                                                         |
| Cache / queue     | Redis (Upstash)                                                     | Session state, rate-limiting counters, lab-runtime queues.                               |
| Lab runtime       | Docker on Fly.io                                                    | Per-session ephemeral containers. See ADR-0001.                                          |
| Auth              | Clerk                                                               | Email + magic link + Google for individuals. SSO comes later when an enterprise asks.    |
| Payments          | Stripe                                                              | $40/mo subscription, monthly billing, no annual at launch.                               |
| Email             | Resend (transactional)                                              | Receipts, password resets, lab-completion notifications. No marketing email at launch.   |
| Observability     | Sentry + Axiom (logs)                                               | Sentry for client + server errors, Axiom for structured proxy/lab logs.                  |
| Analytics         | PostHog                                                             | Self-hostable later, generous free tier now. Track cohort retention by track completion. |
| Deployment        | Vercel (frontend), Fly.io (backend services + lab runtime)          | Vercel for the marketing site + Next.js app, Fly for the proxy + validators + sandboxes. |
| CI                | GitHub Actions                                                      | Includes the per-lab solution-validation step (see ADR-0003).                            |
| Repo structure    | Monorepo via Turborepo                                              | One repo for app + proxy + validator + content.                                          |

## Why

The whole stack is a deliberate boring-tech bet. Every choice above is something a single engineer can debug at 2am. The novel parts of this product are the labs, the validation, and the content quality — not the framework choices.

A few specific calls worth defending:

- **Hono over Express/Fastify.** Smaller, faster, native TS, edge-deployable. We don't need Express's ecosystem inertia.
- **Clerk over building auth ourselves.** Auth is a tarpit. We pay Clerk's per-MAU fee gladly until SSO/SAML demand justifies a swap.
- **Fly.io for sandboxes.** Sub-3s cold start, region-local, very good API. AWS ECS is the fallback if we ever need it for compliance reasons.
- **No GraphQL.** REST + JSON. No federation, no schema-first ceremony.
- **No microservices for v1.** Two services (app + proxy) plus the lab runtime. We can split the validator out if it gets noisy, but no premature distribution.
- **No Kubernetes.** Hard pass for v1. Fly machines are enough.

## Alternatives considered

- **Remix instead of Next.js.** Equivalent quality, smaller community, less Vercel integration. No reason to pick the smaller ecosystem.
- **AWS-native (ECS + RDS + Cognito).** Faster to swap into for enterprise tier later. Slower to ship MVP. We can migrate if a $1M deal demands it.
- **Build our own editor instead of Monaco.** No.
- **Use Anthropic Bedrock proxy for everything.** Extra hop, no clear benefit, blocks us from using Anthropic-only features that ship faster on `api.anthropic.com`.

## Consequences

- ~$200–500/mo infra at launch (Vercel + Fly + Neon + Upstash + Clerk + Stripe + observability), growing to ~$2K/mo at 500 paying users + Claude API spend on top.
- We're betting on Vercel's pricing not getting weird. If it does, Next.js apps deploy elsewhere fine.
- Single engineer can run this. Two is plenty.

## Build order

This is the order Claude Code should build in:

1. **Marketing landing page** (Next.js, single file). Captures email signups. Confirms branding works at this density.
2. **Auth + Stripe checkout flow** (Clerk + Stripe). Marcus can pay $40/mo. We have a real customer record.
3. **Lab runtime — proof of concept.** One hardcoded lab. Container spin-up, editor, terminal, proxy passes Anthropic call, validation runs. End-to-end, no polish.
4. **Validation engine** generalized. `validate.yml` driven, rule library, CI.
5. **Content scaffolding** — first 5 labs in one track (Agentic Architecture). Authored by founding team.
6. **Dashboard + readiness score.** Per-domain progress, recommended next lab.
7. **Mock exam engine.** Full-screen UI, timer, scoring, per-domain breakdown.
8. **Remaining content** — 45 more labs, 1 mock exam — to ship MVP.
9. **Polish + launch** — landing page, pricing page, security docs, accessibility audit, public launch.

Anything not on that list is post-MVP.

## Open follow-ups

- Decide whether to pre-pay annual Fly.io and Neon for ~20% discount once usage stabilizes.
- Decide DPA / data-residency posture for EU customers (this matters for Marcus's bank).
- Decide on a status page provider (probably Statuspage.io or self-hosted Cachet).
