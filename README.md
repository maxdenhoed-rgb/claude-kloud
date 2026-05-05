# claude-kloud

Hands-on Claude lab platform that prepares senior architects to pass the Claude Certified Architect — Foundations (CCA-F) exam. Real Claude API sandboxes, scenario-based labs, mock exams that mirror the real format. Density-first design for working architects who do not want to be talked down to. Working name; final name TBD.

## Quickstart

Prerequisites: Node `>= 24.15.0` and pnpm `>= 10`. Pin both with the included `.nvmrc` / `.tool-versions`. If you do not have pnpm, `npm install -g pnpm@latest`.

```sh
pnpm install
pnpm dev    # marketing page on http://localhost:3000
```

Other root scripts:

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `pnpm build`        | Build all workspaces.           |
| `pnpm lint`         | ESLint across the repo.         |
| `pnpm typecheck`    | `tsc --noEmit` across packages. |
| `pnpm test`         | Vitest across packages.         |
| `pnpm format`       | Prettier write across the tree. |
| `pnpm format:check` | Prettier check, used in CI.     |

## Where things are

- `apps/web` — Next.js 15 app. Marketing page today; dashboard, lab UI, and mock exam UI land later.
- `adrs/` — Architecture Decision Records. Read these before changing anything load-bearing.
- `design-artifacts/` — Product blueprint and visual identity. Read the identity doc before writing UI copy.
- `docs/` — Long-form docs, including the engineering scaffolding & CI/CD requirements.

## Documents to read first

- `design-artifacts/design-blueprint.md` — product context, persona Marcus, anti-goals.
- `design-artifacts/design-identity.md` — voice, density, forbidden words. Mandatory reading before writing copy.
- `adrs/0001-lab-runtime.md` through `adrs/0006-cicd-platform.md` — architecture decisions in order.
- `docs/requirements-engineering-cicd.md` — engineering scaffolding and CI/CD requirements (treat each `REQ-` as a checklist item; ADR-0006 supersedes the platform choice from ADO to GitHub).

## Build phase

Pre-MVP. Step 1 of the build order in `adrs/0005-tech-stack.md` §Build order is the marketing landing page. Subsequent steps (auth, lab runtime, validation, content) are scaffolded only when the prior step has been reviewed.

## Conventions

- TypeScript everywhere except lab starter files.
- Conventional Commits (`feat(scope):`, `fix(scope):`). Enforced by commit-msg hook.
- Squash-merge to `main`. Short-lived feature branches.
- API responses: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. No exceptions.
- Voice: direct, technical, no filler. See `design-artifacts/design-identity.md` for forbidden words.
