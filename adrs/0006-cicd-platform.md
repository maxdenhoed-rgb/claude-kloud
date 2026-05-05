# ADR-0006 — CI/CD Platform

**Status:** Accepted
**Date:** 2026-05-05
**Decision-maker:** Founding team
**Supersedes:** the "CI" row in `adrs/0005-tech-stack.md` (re-affirms it after `docs/requirements-engineering-cicd.md` proposed switching to Azure DevOps)

## Context

`adrs/0005-tech-stack.md` named GitHub Actions as CI. The subsequent requirements document `docs/requirements-engineering-cicd.md` re-routed CI/CD to Azure DevOps to align with Xebia's enterprise tooling and to ease eventual upmarket sales. We re-evaluated that switch before scaffolding step 1.

The product deploys to Vercel (web) and Fly.io (proxy, validator, lab runtime). Both vendors document their primary CI integration against GitHub. The team is one founding engineer plus Xebia time. There is no enterprise customer in the pipeline today; the first one is months away at best.

## Decision

CI/CD platform is **GitHub**: GitHub Actions for pipelines, GitHub for source control, GitHub Issues for work tracking. This holds at least until the first enterprise contract specifically requires Azure DevOps.

- Pipelines defined in YAML under `.github/workflows/`.
- Microsoft-hosted runners (`ubuntu-latest`) at launch, per the same NG2 logic in the requirements doc — no self-hosted runners until cost or compliance forces it.
- Branch protection on `main` enforced via GitHub rulesets.
- Issues + Projects for tracking; no Linear, no Jira, no ADO Boards.
- Secrets stored as GitHub Actions secrets and (for production runtime) Vercel env vars + Fly secrets.

## Why

- **Vercel integration.** Vercel's Git integration with GitHub is first-class: per-PR previews, automatic alias domains, build status posted back to the PR. Vercel + Azure Repos works but is a second-class path with documented friction. Step 1's deliverable is a Vercel preview; we optimize for it.
- **Fly.io ergonomics.** Fly's documented deploy patterns (`flyctl deploy`, `superfly/flyctl-actions`) lead with GitHub Actions. ADO works via shell-out to `flyctl`, but every Fly recipe online assumes Actions.
- **Solo-founder ergonomics.** GitHub Issues, PRs, Actions, and the CLI are one mental model. ADO splits work tracking, repos, pipelines, and artifacts across distinct UIs. The cost of context-switching is real for a one-person team.
- **Ecosystem.** The community marketplace for Actions is the largest CI ecosystem on the planet. Snyk, Trivy, GitGuardian, Vercel, Fly, Sentry, and Turborepo Cloud all ship official Actions. Most of them ship ADO tasks too, but the ergonomics are GitHub-first.
- **No enterprise pull yet.** ADO's main strength is Microsoft Entra integration and audit posture for buyers who already standardized on it. We have zero enterprise prospects today. Building for a buyer who does not exist is premature optimization.

## Why not Azure DevOps (yet)

- **Vercel integration is weaker.** Doable, but every guide is "step 1, mirror to GitHub." That eliminates the platform's main advantage.
- **Audit-trail argument is preempted by GitHub's posture.** GitHub Enterprise + audit log streaming clears most tier-1 bank security questionnaires. The gap to ADO is real but narrow, and not relevant pre-contract.
- **Two systems to learn.** ADO's pipeline YAML, variable groups, environments, and approvals are a separate dialect from Actions. The founding engineer should learn one CI system deeply, not two shallowly.

## Alternatives considered

- **Azure DevOps (the requirements doc's choice).** Rejected for now. See above.
- **GitLab CI.** Rejected. No reason to leave GitHub for it unless we're already on GitLab.
- **CircleCI.** Rejected. Strong product, but no advantage over Actions for our shape, and one more vendor relationship.
- **Self-hosted Drone / Woodpecker.** Rejected. Ops cost of running our own CI is unjustifiable at this scale.

## Migration triggers (when we revisit)

We move to Azure DevOps if **any one** of the following happens:

- A signed enterprise contract requires ADO Pipelines as a control.
- A buyer's procurement / risk team rejects GitHub-hosted CI in writing.
- Xebia internal tooling integration (e.g., a shared ADO org for client work) becomes a meaningful win.

ADO migration is scoped at **1–2 engineering weeks**: port `.github/workflows/*.yml` to `azure-pipelines.yml` templates, recreate environments + approvals, swap secrets store. The requirements doc (`docs/requirements-engineering-cicd.md`) already specifies the target shape, so the porting target is well-defined.

## Consequences

- `docs/requirements-engineering-cicd.md` REQ-numbers stay valid as the **target spec**, but each `REQ-` that names ADO ("Azure DevOps Pipelines," "Azure Repos," "ADO Boards," "ADO Tests," "Azure Key Vault," "Azure Container Registry") reads as "the GitHub equivalent" until ADO migration. A follow-up edit to the requirements doc will land alongside this ADR's acceptance.
- Production secrets land in Vercel env vars (web) and Fly secrets (backend services). Azure Key Vault is deferred until ADO migration or enterprise demand.
- ACR is replaced by GitHub Container Registry (GHCR) for any Docker images we publish. Switching back to ACR is a registry URL change.
- ADO Boards work-item linking (REQ-4.5) is replaced by GitHub Issues linking. Same intent, different syntax.

## Solo-founder relaxations (sunset condition: team size ≥ 2)

While the team is one engineer, two requirements relax:

- **REQ-4.5 "Linked work item required"** is downgraded to "linked issue encouraged." A solo engineer self-reviewing every PR does not benefit from the gate.
- **REQ-13.6 "Production approval gate"** runs in audit-trail-only mode (the deploy is logged and announced, but does not block on a second approver) since there is no second approver.

Both relaxations sunset the day a second engineer commits to `main`. At that point, branch protection requires a reviewer and the prod environment requires a second approver, no exceptions.

## Open follow-ups

- Edit `docs/requirements-engineering-cicd.md` to mark the ADO REQs as "GitHub equivalents apply until ADR-0006 is superseded." Track as a docs PR.
- Decide GitHub Issues vs GitHub Projects (board) for tracking. Default: Issues with labels until volume justifies a Project board.
- Revisit GHCR vs Docker Hub vs ACR when the proxy/validator ship (step 3+).
