# Design Blueprint

> A hands-on Claude lab platform that prepares senior architects to pass the Claude Certified Architect — Foundations (CCA-F) exam, with real Claude API sandboxes, scenario-based exercises, and density appropriate for people who hate being talked down to.

## Vision

Anthropic Academy teaches you Claude. We make sure you can do Claude under pressure.

The CCA-F exam is 60 scenario-based multiple-choice questions in 120 minutes, weighted across five domains. Anthropic's 13 free Skilljar courses cover the material conceptually. What's missing is the muscle memory: the ability to look at a regulated workload, sketch the agent topology in three minutes, defend the model selection, predict the failure modes, and pick the right MCP boundary — repeatedly, in scenario after scenario, until the patterns are reflexive. That's what KodeKloud built for Kubernetes. We're building it for Claude.

## v1 persona — Marcus

47, Principal Architect at a tier-1 bank. Twenty years in enterprise architecture. Recently asked to chair the bank's AI architecture committee. Has read the Claude API docs and skimmed an MCP article, but hasn't actually built an agent loop. Six weeks before the committee's first technical review. Will not tolerate drag-and-drop blocks or 4-minute "intro to AI" videos. Wants scenario-based depth: "given this regulated workload, design the agent topology — and defend it." Pulls out his own card because L&D approval takes longer than the committee will wait.

## Pricing

**$40/month, self-pay, individual.** Single tier at launch.

This sits deliberately between consumer ($20–30 — feels disposable) and prosumer ($60–100 — needs justification). $40 is the "I'll expense it on my personal card and not tell anyone" price for a senior IC. Stripe, monthly, cancel anytime, no annual discount at launch (we'll add it once we know retention curves).

**Move upmarket** comes later, in this order: team plans (5–25 seats, $35/seat) → enterprise (50+ seats, security questionnaire, SSO, $25/seat) → eventually a Xebia consulting bundle. Each tier earns its existence by demand from the tier below — we don't build enterprise until enterprise customers ask for it.

## Feature set

**MVP (ship in 8–12 weeks):**

- 5 lab tracks aligned to CCA-F domains, in their actual exam weights — Agentic Architecture (27%), Claude Code Workflows (20%), Prompt Engineering & Structured Output (20%), Tool Design & MCP (18%), Context Management & Reliability (15%).
- 40–50 hands-on labs total in MVP, each one self-contained, 15–45 minutes.
- Each lab: a scenario brief, a code editor, a terminal, a real Claude API sandbox, an auto-grader, and a "show solution" reveal.
- One full-length mock exam (60 questions, 120 minutes, scored, with per-domain breakdown).
- A dashboard showing exam-readiness per domain.
- Stripe checkout, basic auth, account management.

**v1.5 (next 8 weeks after MVP):**

- 3 more mock exams.
- Long-form scenario challenges (open-ended designs graded by Claude with a rubric).
- Lab badges shareable to LinkedIn.
- Email-based weekly progress nudge.

**v2 (parked, intentional):**

- Bootcamp-grad track with scaffolded foundations (different funnel, different content, different price).
- Team plans.
- Cohort-based programs with live office hours.
- Additional Anthropic certifications as they launch (the doc roadmap promises sellers, developers, advanced architects later in 2026).

## What we will NOT build (anti-goals)

- Video-heavy content. Marcus will not watch a 12-minute talking head.
- Drag-and-drop "code" blocks. Insults him.
- Gamification with streaks, points, levels, badges-for-everything. We're not Duolingo.
- A "community" tab as a feature. Communities emerge or they don't; we're not faking one.
- Enterprise SSO, SAML, SCIM, security questionnaires before there's enterprise demand to justify them.
- Free tier. Trials yes, free no — it dilutes the signal and attracts the wrong learners.
- Mobile-first design. He's at a desk with a 27" monitor.
- Our own LLM. We use Claude. Aggressively.

## Moat vs Anthropic Academy

Anthropic Academy on Skilljar is a course catalog. We are a gym.

Their 13 courses are the right curriculum, free, and authoritative — we should explicitly recommend them as preparation. What they don't offer: timed scenario practice, hands-on labs against real Claude API with auto-grading, a mock exam graded against the real CCA-F format, or an ability to know whether you're actually ready. That's our wedge.

We compete on **practice volume** (50+ scenario labs, 4 mock exams), **density** (no fluff, no condescension), and **signal** (a confidence score he trusts before he sits the real exam). If Anthropic ever ships their own lab platform, we'd lose this moat — that's a real risk and we should think about Partner Network status as defensive positioning.

## Go-to-market

**Acquisition motion at launch:**

1. **Content** — long-form blog posts on actual technical depth ("How to design an agent topology under FFIEC constraints"). Indexed for the long tail.
2. **LinkedIn** — Marcus is on LinkedIn, his peers are on LinkedIn, the CCA-F badge is a LinkedIn artifact. Free badges shareable from the platform on completion.
3. **Reddit / HN** — one well-placed Show HN post when MVP is genuinely good.
4. **CCA-F search intent** — SEO + paid against "CCA-F prep," "Claude Certified Architect study guide," etc.

We do **not** do paid social, influencer marketing, or webinars at launch.

**Retention motion:** new lab content shipped weekly, Claude version updates within a week, mock exams refreshed quarterly. Marcus stays subscribed if the content keeps appearing — the moment we stop shipping, he cancels.

## Success metrics

**At MVP launch:**

- 50 paying subscribers within 30 days.
- 30%+ of paid users complete at least one full mock exam in their first 14 days.
- ≥4.5 / 5 rating on lab completion surveys.

**By month 6:**

- 500 paying subscribers, $20K MRR.
- ≥75% pass rate on real CCA-F among users who completed our final mock with ≥800.
- Net revenue retention ≥110% (people stay subscribed past their exam date because the content stays current).

**Disqualifiers (kill signals):**

- <20 paid users at month 3 → product-market fit is wrong, regroup.
- Pass rate parity or worse vs Anthropic Academy alone → our value prop is fake.

## Open questions deferred to ADRs

- How do labs run? → ADR-0001
- How do exercises auto-grade? → ADR-0002
- Who writes the labs? → ADR-0003
- How do we keep mock exams legitimate? → ADR-0004
- What's the tech stack? → ADR-0005
