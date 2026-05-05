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

## Auto-merge

`main` is the only long-lived branch. PRs merge via `gh pr merge --auto --squash --delete-branch`, which queues the squash-merge to fire as soon as required checks pass and the required approval lands. Branch protection on `main` (canonical JSON in `infra/github/branch-protection-main.json`) currently requires the `typecheck / lint / build / test` check (from `pr-validation.yml`) plus 1 approving review. The `claude pr-reviewer` approval counts during the solo-founder phase.

### Re-applying branch protection from JSON

The JSON file is the source of truth. If the rules drift, re-apply with:

```sh
gh api -X PUT /repos/maxdenhoed-rgb/claude-kloud/branches/main/protection \
  --input infra/github/branch-protection-main.json
```

### Adding `claude pr-reviewer` to required checks (deferred)

The `claude-review.yml` workflow has not yet produced a check-run on the repo, so the check name `claude pr-reviewer` does not exist in GitHub's status-check namespace yet. After the first PR runs claude-review and the check appears (verify with `gh api /repos/maxdenhoed-rgb/claude-kloud/commits/<sha>/check-runs`), add it to the required checks list:

```sh
gh api -X PATCH /repos/maxdenhoed-rgb/claude-kloud/branches/main/protection/required_status_checks \
  --field 'strict=true' \
  --field 'contexts[]=typecheck / lint / build / test' \
  --field 'contexts[]=claude pr-reviewer'
```

Then update `infra/github/branch-protection-main.json` to add `"claude pr-reviewer"` to the `contexts` array so the file stays canonical.

### Solo-founder branch-protection sunset

`require_last_push_approval` is `false` and `require_code_owner_reviews` is `false` so the `claude pr-reviewer` bot can approve the author's own PRs. When a second engineer commits to `main`, flip both to `true` and re-apply the JSON.

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
