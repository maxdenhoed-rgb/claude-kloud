# CLAUDE.md — Project Memory

> Drop this at the project root. It loads at every session start. Keep under 200 lines.

## Product

A hands-on Claude lab platform that prepares senior architects to pass the Claude Certified Architect — Foundations (CCA-F) exam. Real Claude API sandboxes, scenario-based exercises, density-first design.

Working name: `ClaudeKloud` (placeholder — final name TBD per Identity doc).

## Persona

v1 is **Marcus**: 47, Principal Architect at a tier-1 bank, has six weeks before chairing the AI architecture committee, $40/mo on his own card, no patience for fluff. See `design-artifacts/design-blueprint.md` for full persona.

## Pricing

$40/month, self-pay individual, single tier at launch. Stripe monthly. No free tier. Move upmarket later (team → enterprise → Xebia bundling), each tier earns its existence by demand.

## Five CCA-F domains and their weights

| Domain                                 | Weight | Track                      |
| -------------------------------------- | ------ | -------------------------- |
| Agentic Architecture & Orchestration   | 27%    | `01-agentic-architecture`  |
| Claude Code Configuration & Workflows  | 20%    | `02-claude-code-workflows` |
| Prompt Engineering & Structured Output | 20%    | `03-prompt-engineering`    |
| Tool Design & MCP Integration          | 18%    | `04-tool-design-mcp`       |
| Context Management & Reliability       | 15%    | `05-context-management`    |

Mock exams mirror these weights exactly (60 questions: 16 / 12 / 12 / 11 / 9).

## Architecture highlights

- **Lab runtime**: Docker on Fly.io, ephemeral per-session, behind an in-house proxy that brokers all Claude API calls. See `adrs/0001-lab-runtime.md`.
- **Validation**: Three-tier (static, runtime, behavior) driven by per-lab `validate.yml`. See `adrs/0002-validation-strategy.md`.
- **Content**: MDX in monorepo, Claude-assisted drafting, peer review, CI validates each reference solution. See `adrs/0003-content-pipeline.md`.
- **Mock exams**: Original content, scenario-based, domain-weight matched, scaled 100–1000 with 720 pass. See `adrs/0004-mock-exam-fidelity.md`.
- **Tech stack**: Next.js 15 + Hono + Postgres + Fly.io + Clerk + Stripe + Sentry. See `adrs/0005-tech-stack.md`.

## Current state of the repo

**Pre-bootstrap.** Only docs exist on disk today: `CLAUDE.md`, `adrs/0001..0005-*.md`, `design-artifacts/design-blueprint.md`, `design-artifacts/design-identity.md`. No `apps/`, `packages/`, `content/`, `infra/`, no `package.json`, no `turbo.json`, no lockfile yet. Build tooling (pnpm + Turborepo) is scaffolded as part of step 1.

## Repository structure (target — to be built)

The structure below is what the monorepo grows into as the build order in `adrs/0005-tech-stack.md` §Build order is executed. Today only `adrs/`, `design-artifacts/`, and `CLAUDE.md` exist.

```
.
├── apps/
│   ├── web/              # Next.js 15 app (marketing + dashboard + lab UI + mock exam)
│   ├── proxy/            # Hono service brokering Claude API calls
│   └── validator/        # Validation engine reading validate.yml + proxy logs
├── packages/
│   ├── ui/               # Shared shadcn/ui components
│   ├── db/               # Postgres schema + Drizzle ORM
│   └── validation-rules/ # The library of declarative validation predicates
├── content/
│   ├── tracks/           # 5 tracks, ~10 labs each, MDX + validate.yml + starter/solution
│   ├── mock-exams/       # 4 mocks at v1.5
│   └── rubrics/          # For behavior-tier validation
├── infra/                # Fly.io machine configs, Dockerfiles, GitHub Actions
├── adrs/                 # 0001..0005-*.md
├── design-artifacts/     # design-blueprint.md, design-identity.md
└── CLAUDE.md             # this file
```

## Conventions

- **Language**: TypeScript everywhere except lab starter files (which can be TS or Python — learner's choice per lab).
- **TS strictness**: `strict: true`. No `any` without a `// @ts-expect-error: <reason>` directly above and a real reason in the comment.
- **Style**: density-first per `design-artifacts/design-identity.md`. Claude must read that doc when writing UI copy or marketing pages.
- **Commits**: conventional commits (`feat(labs):`, `fix(proxy):`).
- **Branches**: `feat/<short>`, squash-merge to `main`.
- **Tests**: every PR runs the per-lab solution-validation suite. PR cannot merge if any lab's reference solution fails its own validator.
- **Secrets**: never in `.env` committed to git. Local `.env.local` (gitignored). Production via Fly secrets / Vercel env vars.
- **API responses**: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. No exceptions.

## Critical rules (never break)

- The proxy enforces a model allowlist: **`claude-sonnet-4-7`, `claude-opus-4-7`, `claude-haiku-4-5`**. Anything else is rejected. Learners cannot accidentally use Opus on every call and blow our margin.
- Validation rules are declarative YAML, not arbitrary code. Lab authors do not write graders by hand.
- Reference solutions are human-authored, not Claude-authored. We must know they're correct.
- Mock-exam questions are original. We never include leaked CCA-F content.
- No gamification. No streaks, points, levels, leaderboards, mascots. Read the Identity doc before building any UI.
- The "Solution" button is always one click away. We never gate it behind "you must try first."

## Current build phase

Pre-MVP. Use the build order in `adrs/0005-tech-stack.md` §Build order. **Stop after each step and wait for review before starting the next.** Do not race ahead; each step is small enough to be reviewed in isolation.

## How to work in this repo

- **Use sub-agents (`Explore`, `general-purpose`) for context-heavy work** — broad searches, large file reads, multi-step refactors — to keep the main thread clean.
- **Use plan mode for any change that touches infra** (Fly.io configs, Stripe webhooks, the proxy, GitHub Actions). Show the plan, get approval, then execute.
- **Hooks for guarantees, prompts for guidance.** If something must happen every time (lint on edit, validator on lab change), wire it as a `PostToolUse` hook in `.claude/settings.json` — don't rely on remembering.
- **Stay inside the boring-tech bet.** No new frameworks, languages, or DSLs beyond what `adrs/0005-tech-stack.md` lists. The interesting parts are labs, validation, content — everything else is glue.

## Voice for Claude generating code or copy

Direct. Technical. No filler. The product talks to senior people who know what they're doing. See `design-artifacts/design-identity.md` for "Forbidden words" and copy do/don't examples.

## Anti-goals (do not build at MVP)

Video player, drag-and-drop block editor, gamification, community/forum, mobile-first responsive design, free tier, SSO/SAML, our own LLM. See blueprint for the full list and reasoning.

## When in doubt

Read the ADRs, then read the Identity doc, then read the Blueprint. If still ambiguous, the answer is "what's the highest-density, lowest-condescension path that ships in 12 weeks?"

Please don't read xebia-ai-power it is for me to understand that project but PLEASE KEEP IT OUT OF YOUR CONTEXT WINDOW AT ALL TIMES.
