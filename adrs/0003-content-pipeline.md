# ADR-0003 — Content Authorship Pipeline

**Status:** Accepted
**Date:** 2026-05-05

## Context

The product is the labs. Without 50+ high-quality labs at MVP and a cadence of new content shipping weekly thereafter, retention dies and the moat doesn't exist. We need a content pipeline that produces dense, technically-correct, exam-aligned labs with one founding-team author + AI-assisted drafting + structured review.

## Decision

Labs are authored as MDX files in a content monorepo, drafted with Claude assistance, human-reviewed by a Claude practitioner, validated against a live Claude API in CI, and versioned to specific Claude model versions.

### Repository layout

```
content/
├── tracks/
│   ├── 01-agentic-architecture/
│   │   ├── 1.1-first-agent-loop/
│   │   │   ├── lab.mdx              # the scenario brief + content
│   │   │   ├── starter/             # files dropped into the learner's container
│   │   │   ├── solution/            # reference solution, gated behind "show solution"
│   │   │   ├── validate.yml         # see ADR-0002
│   │   │   └── meta.yml             # title, duration, prerequisites, last-validated date
│   │   ├── 1.2-multi-step-research-agent/
│   │   └── ...
│   ├── 02-claude-code-workflows/
│   ├── 03-prompt-engineering/
│   ├── 04-tool-design-mcp/
│   └── 05-context-management/
├── mock-exams/
│   └── exam-01/
│       ├── questions.yml
│       └── answer-key.yml
└── rubrics/                          # for behavior-tier validation
```

### Authoring workflow

1. **Scenario draft.** Author writes a scenario brief — ≤ 300 words, situated, technical. Claude is used as a brainstorming partner for scenario realism, not as the primary author.
2. **Reference solution.** Author writes the canonical solution code in `solution/`. This is the gold standard.
3. **Starter files.** Author derives starter files from the solution by stripping out the parts the learner is supposed to write. Comments mark `// TODO:` blocks.
4. **Validation rules.** Author writes `validate.yml` against the solution, then verifies the validator passes when run against the solution and fails when run against an obviously-broken variant.
5. **Self-review.** Author runs the lab end-to-end as if they were a learner, in <45 minutes. If it takes longer, the lab is too big and gets split.
6. **Peer review.** A second Claude practitioner runs the lab cold without seeing the solution. They flag ambiguities, unrealistic constraints, or over-prescription.
7. **CI validation.** On merge, CI spins up the lab container, runs the reference solution, and asserts that the validator returns pass. Labs that fail CI cannot ship.
8. **Versioning.** `meta.yml` records `last_validated_with: claude-sonnet-4-7`. When Anthropic releases a new model, a scheduled CI job re-runs every lab against the new model and flags failures for review.

### Use of Claude in authoring

- Brainstorming scenario settings (FFIEC, HIPAA, GDPR, FedRAMP — Marcus has seen them all).
- Drafting initial scenario briefs (Claude writes 3 candidates, author picks one and rewrites).
- Reviewing labs for clarity, ambiguity, and exam-domain alignment.
- **Not** for writing reference solutions (the human author writes those — we need to know they're correct).
- **Not** for writing validation rules (deterministic logic, human-authored).

## Why

- **MDX in a repo** is the same pattern that worked for Stripe Docs, Vercel Docs, KodeKloud course content. Markdown + version control + CI + peer review. No CMS for v1.
- **Claude-assisted drafting** is the only way one or two authors can produce 50 labs in 12 weeks. We respect what we're building enough to use it.
- **CI validation** is non-negotiable. If we ship a lab where the reference solution fails, our validator credibility evaporates.
- **Model versioning** is the slow killer. Anthropic ships a new Sonnet, our labs subtly break. We have to detect this within days, not weeks.

## Alternatives considered

- **Headless CMS (Contentful, Sanity).** Rejected. Lab content is heavily code-and-config; markdown + repo wins on dev ergonomics.
- **Bring on freelance authors via marketplaces.** Rejected for v1 — quality bar too high to manage, our editorial muscle isn't built yet. Revisit at scale.
- **Crowdsourced labs.** Rejected for v1, possibly forever. The signal is "Xebia practitioners wrote this" — crowdsourcing dilutes that.

## Consequences

- We need a content engineering pipeline: a CLI to scaffold a new lab (`new-lab.ts <track> <name>`), CI to validate each lab's reference solution, a scheduled job to re-validate against new model versions.
- We need a content style guide (separate doc, lives in `content/STYLE.md`), reflecting the Identity doc.
- The first author (founding team) writes the first 10 labs alone. Reviewer is hired in by lab #15.
- Lab content is, for now, **not** the IP we monetize. Enterprise-tier later might gate certain labs, but at $40/mo individual, all labs are accessible.

## Open follow-ups

- Decide a strict 45-minute lab-length limit: hard cap or soft target.
- Decide on a "lab template" structure (shared across all labs) so authors don't reinvent the wheel.
- Decide whether to publish a public roadmap of upcoming labs (community-feedback signal vs roadmap-leak risk).
