# Contributing

## Branch model

Trunk-based. Short-lived feature branches off `main`. No `develop`. No release branches at launch.

Branch names: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`, `docs/<short-slug>`.

## Commits

Conventional Commits, validated locally by a `commit-msg` hook and on PR by a CI check.

```
feat(web): add email signup form to landing page
fix(proxy): treat 429 retries as idempotent
docs(adrs): supersede ADR-0005 CI row via ADR-0006
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.

Allowed scopes (non-exhaustive): `web`, `proxy`, `validator`, `content`, `infra`, `adrs`, `docs`, `repo`.

## PR checklist

Before requesting review:

- [ ] `pnpm typecheck` passes locally.
- [ ] `pnpm lint` passes locally.
- [ ] `pnpm test` passes locally.
- [ ] `pnpm build` passes locally.
- [ ] No forbidden words from `design-artifacts/design-identity.md` in any UI copy or commit messages (no "amazing," "awesome," "exciting," "let's," "journey," "unlock," "level up," "boost," "supercharge," "AI-powered").
- [ ] If you deviated from a `REQ-` in `docs/requirements-engineering-cicd.md`, document the rationale in the PR description.
- [ ] If the change is architecturally significant, add or update an ADR under `adrs/`.

## Solo-founder relaxations (sunset condition: team size ≥ 2)

Until a second engineer commits to `main`, two requirements relax:

- **REQ-4.5 "Linked work item required"** is downgraded to "linked issue encouraged."
- **REQ-13.6 "Production approval gate"** is audit-trail-only (the deploy is logged, not blocked on a second approver).

Both relaxations sunset automatically the day a second engineer commits to `main`. At that point, branch protection requires a reviewer and the prod environment requires a second approver.

## Local dev

```sh
pnpm install
pnpm dev
```

Husky installs git hooks via the `prepare` script on `pnpm install`. If hooks do not run, ensure the repo has been initialized with `git init` (Husky requires a `.git` directory at install time).

## File and directory layout

- `apps/*` — applications (Next.js, Hono, etc.).
- `packages/*` — shared libraries (UI, db, validation rules — to be added in later steps).
- `content/*` — labs, mock exams, rubrics (added in step 5).
- `adrs/*` — architecture decision records.
- `design-artifacts/*` — blueprint and identity.
- `docs/*` — long-form docs, requirements.
- `.github/*` — CI workflows, PR template, CODEOWNERS, dependabot config.

## When in doubt

Read the ADRs, then read the identity doc, then read the blueprint. If still ambiguous, the answer is "what is the highest-density, lowest-condescension path that ships in 12 weeks?"
