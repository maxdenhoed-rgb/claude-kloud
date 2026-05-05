# ADR-0004 — Mock Exam Fidelity

**Status:** Accepted
**Date:** 2026-05-05

## Context

The mock exam is the most important single page in the product. It's what Marcus uses to decide "am I ready to spend $99 on the real CCA-F." If our mock score correlates badly with real-exam performance, the trust signal collapses and the platform's value evaporates. We must ship a mock exam that is statistically credible and ethically sourced.

## Decision

Mock exams are **original content**, authored by Xebia practitioners, structurally faithful to the real CCA-F (60 questions, 120 minutes, 5 domains weighted 27/20/20/18/15), graded on the same 100–1000 scale with a 720 pass mark. We never use leaked, scraped, or memorized questions from the real exam.

### Structure

- 60 multiple-choice questions per mock.
- 4 mock exams shipped by month 4 (1 at MVP, 3 more in v1.5).
- Each mock is balanced across the five CCA-F domains in their actual weights:
  - Agentic Architecture & Orchestration — 16 questions (27%)
  - Claude Code Configuration & Workflows — 12 questions (20%)
  - Prompt Engineering & Structured Output — 12 questions (20%)
  - Tool Design & MCP Integration — 11 questions (18%)
  - Context Management & Reliability — 9 questions (15%)
- Within each domain, questions span the cognitive levels we expect on the real exam: ~30% recall, ~50% application, ~20% analysis. (Anthropic publishes domain weights but not cognitive-level mix; this is our best estimate from the published exam guide.)

### Question format

All questions are scenario-based. None are "what does the `tool_choice` parameter do?" Every question is "given this scenario, which choice is the right next move?" Four answer choices, exactly one correct. Distractors are plausible — one or two are tempting wrong-for-good-reasons, not obviously wrong.

Each question carries:

- A scenario stem (1–4 sentences).
- An optional code block (when relevant).
- 4 answer choices (lettered A–D).
- A correct answer.
- A 1–3 sentence explanation, shown after submission.
- A domain tag and a "topic" tag (sub-domain, used for granular weakness reports).

### Grading

- Raw correct count is converted to scaled score 100–1000 with a passing line at 720, mirroring the real exam.
- Per-domain percentage is shown immediately after submission.
- Time used vs. allotted is shown.
- "Mark for review" flag during the exam. Navigator at the end. Submit-and-finish at any point.

### Anti-cheating / anti-leak posture

- Question pool size: 4 mocks × 60 questions = 240 questions at v1.5. We rotate the order, but the pool is small enough that a determined learner could see most questions across multiple mocks. Acceptable for a paid product where the goal is _learning_, not gatekeeping.
- We do **not** ship the question bank publicly. Mock-exam questions are gated behind login.
- We do **not** include real-exam questions, even if "everyone has them on a forum." This is both an ethics and an Anthropic-relationship issue. If Anthropic ever offers official prep partnership status, our content has to pass their bar.

## Why

- **Domain weight matching** means our score is the closest possible proxy for the real exam's score. If a learner gets 740 on our mock, they should land in the ballpark of 720 on the real one.
- **Original content** keeps us in good standing with Anthropic and gives us defensible IP. The Partner Network is mentioned in the Anthropic docs; we want to be on the right side of it.
- **Scenario-based, not recall** matches what the published CCA-F guide says explicitly: "scenario-based multiple-choice questions."
- **Per-domain reporting** is Marcus's actual need. He doesn't want a score; he wants to know which of the five domains he's weakest in, so he can drill into those labs.

## Alternatives considered

- **Use exam dumps from forums.** Rejected categorically. Ethics, IP risk, and the dumps are unreliable anyway.
- **Generate questions on-the-fly with Claude.** Rejected for the official mock exams (consistency and quality risk). Reserved for a future "infinite practice" mode where unique scenario questions are generated per learner — clearly labeled as "AI-generated practice," not a mock.
- **Time-limit relaxed (180 minutes vs the real 120).** Rejected. Time pressure is part of what we're training. A relaxed mock teaches the wrong thing.

## Consequences

- We need an exam-engine UI distinct from the lab UI: full-screen, single question, timer, navigator, mark-for-review (see Identity doc).
- We need a question authoring pipeline analogous to the lab pipeline (probably even reusing the same MDX/repo conventions).
- We need a calibration step before launch: 5 internal beta testers (Xebia engineers) take the mock, we compare distribution to publicly-discussed real-exam-difficulty signals, adjust if our mocks are systematically too easy or too hard.

## Open follow-ups

- Establish question-review process: at least two Claude practitioners review every question before it ships. One must be CCA-F certified.
- Decide whether learners can see the explanation immediately after each question or only after the full submission. Lean toward end-of-exam reveal, mirroring real-exam behavior.
- Decide on cooldown rules (can a learner take the same mock twice on the same day? — lean: no, with a 48-hour cooldown).
