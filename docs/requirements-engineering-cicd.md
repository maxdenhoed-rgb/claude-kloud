# Requirements — Engineering Scaffolding & CI/CD on Azure DevOps

**Status:** Draft for implementation
**Date:** 2026-05-05
**Supersedes:** the "GitHub Actions" reference in `adrs/0005-tech-stack.md`. CI/CD platform is Azure DevOps. The rest of ADR-0005 stands.

## 1. Background

The CCA-F lab platform is a TypeScript monorepo (Next.js web app, Hono API proxy, validation engine, content packages) deploying to Vercel (frontend) and Fly.io (backend services + lab runtime sandboxes). See `docs/design-blueprint.md` for product context and `adrs/0005-tech-stack.md` for the runtime architecture.

This document specifies the requirements for the engineering scaffolding (monorepo setup, local dev experience, code quality tooling) and the CI/CD pipelines that build, test, and deploy it. The CI/CD platform is Azure DevOps (ADO) — chosen for alignment with Xebia's enterprise tooling and for cleaner integration with the enterprise-tier customers we'll move upmarket toward.

## 2. Goals

- **G1** — A new engineer can clone the repo and run the full stack locally in under 15 minutes with one command.
- **G2** — Quality gates catch typos, type errors, lint violations, and broken lab solutions before code review.
- **G3** — Build feedback for a typical PR returns in under 5 minutes.
- **G4** — Deploys are zero-downtime for the proxy and the web app.
- **G5** — Production deploys require manual approval; staging and dev deploy automatically.
- **G6** — Secrets never live in code, never live in pipeline YAML, and are rotated quarterly.
- **G7** — The pipeline platform produces an audit trail acceptable to a tier-1 bank's security questionnaire (Marcus's bank).
- **G8** — Per-lab reference solutions are validated automatically; no lab can ship if its own validator rejects its solution.

## 3. Non-goals

- **NG1** — Multi-cloud deployment automation (Azure + GCP + AWS). We deploy to Vercel and Fly.io; that's it.
- **NG2** — Self-hosted ADO build agents at launch. Microsoft-hosted agents are sufficient until cost or compliance forces otherwise.
- **NG3** — Kubernetes deployment. Lab runtime is Fly machines per ADR-0001.
- **NG4** — Compliance certifications (FedRAMP, FFIEC, ISO 27001) at launch. Defer to enterprise tier.
- **NG5** — Internal package registry. We use the public npm registry until we have private packages worth hosting.

## 4. Repository requirements

- **REQ-4.1** — Single monorepo, hosted in Azure Repos under a project named `claude-kloud` (placeholder name). Mirroring to GitHub for community visibility is out of scope at launch.
- **REQ-4.2** — Monorepo orchestrator: Turborepo. Workspaces declared in `pnpm-workspace.yaml`.
- **REQ-4.3** — Top-level layout per `CLAUDE.md` §Repository structure: `apps/`, `packages/`, `content/`, `infra/`, `docs/`, `adrs/`.
- **REQ-4.4** — Branching: trunk-based, with short-lived feature branches off `main`. No `develop`, no release branches at launch.
- **REQ-4.5** — Branch policies on `main`:
  - Pull request required (no direct pushes).
  - At least one reviewer approval.
  - All required pipelines must pass (Build, Test, Security, Lab Validation).
  - Linked work item required (ADO Boards).
  - Squash-merge only.
- **REQ-4.6** — Commit message convention: Conventional Commits (`feat(scope):`, `fix(scope):`, etc.). Enforced via commit-msg hook (Husky) locally and via a lightweight pipeline check.
- **REQ-4.7** — Tag releases as `v0.1.0`, `v0.2.0`, etc. semver after the first paid customer ships. Pre-paid-customer tags are not required.

## 5. Local development scaffolding

- **REQ-5.1** — Package manager: `pnpm`. Version pinned via `packageManager` field in root `package.json` and Corepack.
- **REQ-5.2** — Node version pinned via `.nvmrc` AND `.tool-versions` (asdf). Version: latest LTS at project start.
- **REQ-5.3** — One-command setup: `pnpm install` after clone must produce a working dev environment. `pnpm dev` starts all services (web on :3000, proxy on :3001, validator on :3002, Postgres + Redis via Docker Compose).
- **REQ-5.4** — `docker-compose.yml` at the repo root provides Postgres and Redis for local dev. No other services required locally.
- **REQ-5.5** — DevContainer support: `.devcontainer/devcontainer.json` configures VS Code remote dev with all toolchains pre-installed. Codespaces-compatible.
- **REQ-5.6** — Environment variables managed via `.env.example` (committed) and `.env.local` (gitignored). A script `pnpm env:pull` pulls dev secrets from 1Password (or Doppler — see REQ-12.4).
- **REQ-5.7** — Pre-commit hooks via Husky:
  - `pre-commit`: `lint-staged` runs ESLint + Prettier on changed files.
  - `commit-msg`: validates Conventional Commits format.
  - `pre-push`: runs `pnpm typecheck` on changed packages.
- **REQ-5.8** — `pnpm` scripts at the root:
  - `dev` — start everything.
  - `build` — build everything.
  - `lint` — ESLint across the monorepo.
  - `format` — Prettier write.
  - `typecheck` — `tsc --noEmit` across packages.
  - `test` — Vitest across packages.
  - `test:e2e` — Playwright across `apps/web`.
  - `validate:labs` — runs every lab's reference solution against its own `validate.yml`.

## 6. Code quality tooling

- **REQ-6.1** — TypeScript strict mode for every package: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. No `any` without an inline `// @ts-expect-error: <reason>`.
- **REQ-6.2** — ESLint with `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`. A single shared config in `packages/eslint-config-claude-kloud`.
- **REQ-6.3** — Prettier with shared config in `packages/prettier-config`. Print width 100. Single quotes. Trailing commas.
- **REQ-6.4** — `EditorConfig` at the root for whitespace consistency across editors.
- **REQ-6.5** — Markdown linting: `markdownlint` over `docs/` and `adrs/` and `content/` MDX files.
- **REQ-6.6** — Spell-check on docs: `cspell` with a project dictionary including `Claude`, `Anthropic`, `MCP`, `xterm`, etc.

## 7. Testing requirements

- **REQ-7.1** — Unit and component testing: Vitest. One test file per source file convention (`foo.ts` ↔ `foo.test.ts`).
- **REQ-7.2** — React component tests: Vitest + Testing Library + `happy-dom`. No JSDOM unless something requires it.
- **REQ-7.3** — End-to-end tests: Playwright. Three browsers (Chromium, Firefox, WebKit). Tests live under `apps/web/e2e/`.
- **REQ-7.4** — Lab reference solution validation: a custom test runner (`pnpm validate:labs`) that, for each lab, spins up a sandbox, executes the reference solution, runs the lab's `validate.yml` against the proxy log, and asserts a pass.
- **REQ-7.5** — Coverage thresholds:
  - Shared packages (`packages/*`): minimum 70% lines, 70% branches.
  - Apps (`apps/*`): no minimum at launch. Revisit at month 3.
  - Content: not applicable; coverage is replaced by the lab-validation step in REQ-7.4.
- **REQ-7.6** — All test runs publish JUnit-format XML to ADO Tests for surfacing in pipeline UI.
- **REQ-7.7** — Coverage reports published to ADO as code-coverage artifacts.

## 8. Pipeline architecture (Azure DevOps Pipelines)

- **REQ-8.1** — Pipelines defined in YAML, stored under `infra/pipelines/`. No classic UI-edited pipelines.
- **REQ-8.2** — Multi-stage pipelines: `Build → Test → Security → Deploy`. Each stage has explicit dependencies and clear failure semantics.
- **REQ-8.3** — One PR-validation pipeline (`pr-validation.yml`) that runs on every PR targeting `main`. Required for merge per REQ-4.5.
- **REQ-8.4** — One main-branch pipeline (`main.yml`) that runs on every push to `main`, deploying to staging and gating prod on manual approval.
- **REQ-8.5** — One content-only pipeline (`content-validation.yml`) triggered by changes under `content/**`. Runs the per-lab reference-solution validation. Faster path for content-only PRs.
- **REQ-8.6** — One nightly pipeline (`nightly.yml`):
  - Re-runs every lab's validation against the latest pinned Claude model. Catches model-version drift per ADR-0003.
  - Runs Playwright E2E suite against staging.
  - Runs full security scans (deeper than per-PR).
- **REQ-8.7** — Templates: shared YAML templates in `infra/pipelines/templates/` for reusable jobs (build-node-app, deploy-fly-service, etc.). Pipelines compose templates; no copy-pasted YAML.
- **REQ-8.8** — Agent pool: `Azure Pipelines` (Microsoft-hosted), `ubuntu-latest` image. Per NG2.

## 9. Build pipeline requirements

- **REQ-9.1** — Trigger: PR open/sync, push to `main`, push to tags `v*`.
- **REQ-9.2** — Cache: pnpm store cached by `pnpm-lock.yaml` hash. Turborepo remote cache enabled (Turborepo Cloud or self-hosted via Azure Blob Storage — see REQ-15.1).
- **REQ-9.3** — Parallelism: each app builds in its own job in parallel. Packages built once and consumed.
- **REQ-9.4** — Docker images for `apps/proxy`, `apps/validator`, and the lab runtime base image are built and pushed to Azure Container Registry (ACR) on every `main` push. PR builds use ephemeral image tags (`pr-<id>-<sha>`).
- **REQ-9.5** — Image tags: `<service>:<git-sha>` always; additional tag `<service>:latest` only on `main` push.
- **REQ-9.6** — Build artifacts:
  - Source maps uploaded to Sentry with the commit SHA.
  - Next.js standalone build cached for the deploy stage.
  - Test result XML attached to the run.
- **REQ-9.7** — Time budget: typical PR build (no Docker rebuild) completes in < 5 minutes wall-clock. Docker-rebuilding PRs ≤ 12 minutes.
- **REQ-9.8** — Pipeline pre-flight: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint` before any build. Fail fast.

## 10. Test pipeline requirements

- **REQ-10.1** — Unit + component tests run on every PR. Mandatory pass.
- **REQ-10.2** — E2E tests run on every PR labeled `e2e` and on every push to `main`. Mandatory pass on `main`.
- **REQ-10.3** — Lab reference-solution validation runs on every PR that touches `content/**`. Mandatory pass.
- **REQ-10.4** — A PR that does not touch `content/**` skips REQ-10.3 (efficiency).
- **REQ-10.5** — Per-test-suite reports rendered in ADO Tests UI. Per-domain weakness in mock-exam tests surfaced as artifacts.
- **REQ-10.6** — Flaky tests: any test flagged flaky (manually or auto via 3+ flake events in 14 days) is moved to a quarantine suite that does not block merge. A weekly job reports quarantined tests; engineers must triage within 7 days.

## 11. Security and compliance scanning

- **REQ-11.1** — Dependency vulnerability scanning: `pnpm audit` on every PR, plus Snyk integration as a pipeline task. Critical CVEs block merge; high CVEs warn.
- **REQ-11.2** — Container vulnerability scanning: Trivy scan on every Docker image build. Critical or high in OS packages or base image blocks prod deploy.
- **REQ-11.3** — Secret scanning: ADO native secret scanner enabled at the org level + GitGuardian as a pipeline task. Any leaked secret in a PR blocks merge and triggers rotation.
- **REQ-11.4** — Static analysis: SonarCloud project linked to the repo. Quality Gate enforced on PRs (no new bugs, ≤ 1 new code smell critical, no new security hotspots).
- **REQ-11.5** — Software Bill of Materials (SBOM): generated per Docker image (Trivy or Syft) and published as a build artifact. Useful for the bank's procurement questionnaire later.
- **REQ-11.6** — License compliance: deferred to v1.5. FOSSA or similar at that time.

## 12. Secrets management

- **REQ-12.1** — Production secrets live in Azure Key Vault, instance `claude-kloud-prod-kv`.
- **REQ-12.2** — ADO pipelines access Key Vault via a Variable Group linked to the Key Vault. No raw secrets in pipeline YAML.
- **REQ-12.3** — Service principals used for Key Vault access scoped to `get` and `list` only. No `set` from pipelines.
- **REQ-12.4** — Local dev secrets: 1Password CLI (`op`) is the source of truth. `pnpm env:pull` populates `.env.local` from a shared 1Password vault. (Doppler is acceptable substitute if the team prefers; pick one and stick with it.)
- **REQ-12.5** — Anthropic API keys are master keys; the proxy issues short-lived session-scoped keys to learners (per ADR-0001). Master key rotation: quarterly, tracked in a recurring ADO Boards work item.
- **REQ-12.6** — `.env.local` and any `.env*` file other than `.env.example` is in `.gitignore`. Pre-commit hook scans for accidentally-staged `.env` files and rejects.

## 13. Deployment pipeline requirements

- **REQ-13.1** — Frontend (`apps/web`) deploys to Vercel. PR previews automatic via Vercel's Git integration, with Vercel project linked to Azure Repos. Production deploy gated on REQ-13.6.
- **REQ-13.2** — Backend services (`apps/proxy`, `apps/validator`) deploy to Fly.io. Per-environment apps: `claude-kloud-proxy-staging`, `claude-kloud-proxy-prod`. Deploy via `flyctl deploy` from the pipeline using a Fly access token stored in Key Vault.
- **REQ-13.3** — Lab runtime base image deploys to ACR (per REQ-9.4) and is pulled on demand by the lab orchestrator on Fly.
- **REQ-13.4** — Database migrations: applied automatically to dev and staging. Applied to production only after manual approval (REQ-13.6). Migration tool: Drizzle migrations.
- **REQ-13.5** — Environments in ADO Pipelines:
  - `dev` — auto-deploy from any branch on demand. Ephemeral. Cleaned up when the branch is deleted.
  - `staging` — auto-deploy on every `main` push. Persistent. Mirrors prod config except for scale.
  - `prod` — deploy on tag push (`v*`) AND manual approval by a member of the `prod-deploy-approvers` ADO group.
- **REQ-13.6** — Production approval: a single approver from the founding team, audit-logged. No auto-promotion from staging to prod.
- **REQ-13.7** — Rollback: every prod deploy emits a rollback artifact (the previous image tag + previous DB migration version). A `rollback-prod.yml` pipeline accepts a release ID and reverts within 5 minutes.
- **REQ-13.8** — Zero-downtime: required for `apps/web` (Vercel handles natively) and `apps/proxy` (Fly rolling deploy with health checks). The validator may have brief downtime; it doesn't serve learner traffic directly.
- **REQ-13.9** — Smoke tests post-deploy: every prod deploy runs a smoke test suite against prod. If smoke fails, auto-rollback triggers.

## 14. Observability and audit

- **REQ-14.1** — Errors: Sentry, with releases tagged by build ID + git SHA. Source maps uploaded by the build pipeline.
- **REQ-14.2** — Structured logs: Axiom, ingested via Vector or directly from each service. Retention 30 days at launch.
- **REQ-14.3** — Metrics: each service exposes `/metrics` (Prometheus format). Scraped by Fly metrics + forwarded to a basic Grafana Cloud account. Defer custom dashboards to month 2.
- **REQ-14.4** — Health checks: `/health` on every backend service. Liveness only at launch; readiness probes deferred.
- **REQ-14.5** — Pipeline audit: ADO retains pipeline runs and logs for 365 days. Sufficient for the bank security-questionnaire baseline.
- **REQ-14.6** — Deploy notifications: Slack channel `#deploys`. Posted on staging-deploy-success, prod-deploy-success, and any-deploy-failure. No noise for PR previews.

## 15. Caching and performance

- **REQ-15.1** — Turborepo remote cache: hosted on Azure Blob Storage via the `@dotansimha/turbo-remote-cache` self-hosted endpoint, OR Turborepo Cloud (Vercel-hosted). Pick the cheaper option for current usage; revisit at scale.
- **REQ-15.2** — pnpm store cache keyed by `pnpm-lock.yaml` hash. Restored at the start of every job; saved at the end on cache miss.
- **REQ-15.3** — Docker layer cache: BuildKit cache backend pointing at ACR or Azure Blob.
- **REQ-15.4** — Playwright browser cache: cached by Playwright version.

## 16. Versioning and changelog

- **REQ-16.1** — Versioning: changesets (`@changesets/cli`) for shared packages in `packages/*`. Apps in `apps/*` are versioned via tags only.
- **REQ-16.2** — Changelog: each shared package has a `CHANGELOG.md` auto-generated from changesets. The repo root has a top-level `CHANGELOG.md` aggregated from package changelogs at release time.
- **REQ-16.3** — Release notes: ADO Releases generate notes from Conventional Commits between the previous tag and the current tag. Posted to Slack on every prod deploy.

## 17. Documentation

- **REQ-17.1** — Top-level `README.md`: one-paragraph project description, quickstart (clone → setup → dev), link to Blueprint, Identity, ADRs.
- **REQ-17.2** — Per-package `README.md`: what it does, how to run it, public API summary.
- **REQ-17.3** — `CONTRIBUTING.md`: branch model, commit conventions, PR checklist.
- **REQ-17.4** — `infra/pipelines/README.md`: documents each pipeline's purpose, triggers, environments, and ownership.
- **REQ-17.5** — ADRs in `adrs/`. New architectural decisions written as new ADRs, never edited in place after merge unless marked Superseded.
- **REQ-17.6** — ADO Wiki: not used at launch. The repo's `docs/` directory is the canonical knowledge base. Revisit if non-engineering stakeholders need wiki access.

## 18. Acceptance criteria — "scaffolding done"

The scaffolding is considered complete when ALL of the following hold:

- **AC-1** — A new engineer clones the repo, runs `pnpm install && pnpm env:pull && pnpm dev`, and has the full local stack running in under 15 minutes from scratch.
- **AC-2** — A trivial PR (one-line README change) opens, runs PR validation, and merges in under 8 minutes wall-clock.
- **AC-3** — A PR that breaks TypeScript, ESLint, or unit tests is blocked by REQ-4.5 / REQ-9.8 / REQ-10.1.
- **AC-4** — A PR that adds a new lab with a deliberately broken `validate.yml` (it rejects its own reference solution) is blocked by REQ-10.3.
- **AC-5** — A push to `main` deploys to staging, posts to Slack, and runs the smoke test suite.
- **AC-6** — Tagging a release `v0.1.0` triggers prod approval gate; on approval, deploys, runs smoke tests, posts release notes.
- **AC-7** — A simulated leaked secret in a PR is caught by REQ-11.3 and the PR is blocked.
- **AC-8** — A simulated rollback (`rollback-prod.yml` invoked with the previous release ID) restores the previous version in under 5 minutes.
- **AC-9** — All pipeline YAML lives under `infra/pipelines/` and shares logic via templates per REQ-8.7.
- **AC-10** — No secrets exist in any pipeline YAML, repo file, or build log (verified by REQ-11.3 pipeline + manual audit).
- **AC-11** — Sentry receives source-mapped errors from a deployed bug; a release is identified in Sentry by its build ID.
- **AC-12** — The README enables a Xebia consultant unfamiliar with the project to onboard alone in one afternoon.

## 19. Open questions deferred to implementation

- **OQ-1** — Self-hosted vs Microsoft-hosted ADO agents. Default: MS-hosted. Switch trigger: monthly agent cost > $500, OR a compliance requirement that data not leave a controlled environment.
- **OQ-2** — Turborepo Cloud vs self-hosted Turborepo cache. Default: Turborepo Cloud at launch (free tier). Switch trigger: > $50/mo on cache or data residency concerns.
- **OQ-3** — 1Password CLI vs Doppler for local secrets. Pick one before scaffolding starts; either works.
- **OQ-4** — Whether to integrate ADO Boards or use a separate issue tracker (Linear, Jira). Default: ADO Boards for engineering, since we're already there. Revisit if non-engineering teams need access.
- **OQ-5** — Whether the proxy and validator share an image base or have separate Dockerfiles. Default: shared base image with per-service Dockerfile extending it. Implementation can override.

## 20. Out of scope

- A staging environment for content authors to preview labs before merging. Useful eventually; not at launch.
- Canary deploys / blue-green for prod. Defer until traffic justifies it.
- Pen-testing automation. Engage a third-party firm before opening to enterprise customers.
- A public status page. Defer to month 3 or first incident.
- Branch protection bypass for emergency hotfixes. Process is "open a PR, expedite review, merge." We do not break the gate.

---

## How to use this document

This is a requirements doc, not a design doc. Claude Code should treat each `REQ-X.Y` as a checklist item. Implementation is free to choose tools and structure within the constraints; deviations from a `REQ-` need a written rationale in the PR description and an updated entry here (or a follow-up requirement).

When an open question (`OQ-N`) is decided in implementation, the decision should be recorded as either an updated requirement here or a new ADR if the choice is architecturally significant.

This document supersedes the GitHub Actions reference in `adrs/0005-tech-stack.md`. A formal `ADR-0006: CI/CD Platform = Azure DevOps` should be written if Claude Code wants the deviation captured in the ADR log.
