# ADR-0002 — Validation Strategy

**Status:** Accepted
**Date:** 2026-05-05

## Context

Auto-grading is the second of our two credibility wedges (real API being the first). KodeKloud's grading checks "did you create the deployment, did the pod come up, does the service expose port 8080." Ours has to check "did you call the Claude API correctly, did your agent loop handle errors, did your tool definition fit the scenario." The grading must be deterministic enough that learners trust it, and rich enough that "the API call succeeded" isn't the only thing we check.

## Decision

Three-tier validation, run in this order, all three must pass for a lab to be marked complete.

### Tier 1 — Static checks

Run on the learner's source code in the container, before they execute anything.

- Lint with project-specific rules (e.g., must import the official Anthropic SDK, not a wrapper).
- AST checks for required call shapes (e.g., "the lab requires a `tool_choice: {type: 'tool', name: 'X'}` somewhere in the file").
- Type-check passes (TS or mypy).
- Forbidden patterns flagged (e.g., "do not hardcode the API key as a string literal").

### Tier 2 — Runtime checks (the proxy hook)

Every Claude API call passes through the proxy (see ADR-0001). The proxy logs the full request and response. The validator queries the session's call log and asserts on it.

Examples of runtime assertions per lab:

- "Exactly one call was made with `model: claude-sonnet-4-7`."
- "The system prompt included an MCP-style tool registry with three tools, named exactly: `get_account`, `flag_transaction`, `escalate`."
- "At least one call used `cache_control: {type: 'ephemeral'}` on the system prompt."
- "The agent loop executed at least 2 turns and at most 5."
- "On the second turn, the model output a `tool_use` block for `flag_transaction` with the `transaction_id` matching the scenario brief."
- "The final assistant message included a `stop_reason` of `end_turn`, not `max_tokens` or `tool_use`."

Runtime checks are written declaratively per lab, in a `validate.yml` file. Examples below.

### Tier 3 — Behavior checks (Claude grades Claude)

For open-ended labs, after the learner declares "done," we run their final agent against a hidden test scenario and pass the trace + the scenario rubric to a separate Claude instance acting as judge. The judge returns a structured score against a rubric.

This is used sparingly — only for labs where the answer space is genuinely open (e.g., "design an agent topology"). For most labs, Tier 1 + Tier 2 are sufficient and deterministic.

## Validation file format

Each lab ships with a `validate.yml`:

```yaml
lab_id: '1.3-tool-use-error-handling'
title: 'Implement tool retries with exponential backoff'
domain: 'tool-design-mcp'
weight: 0.18

static:
  - rule: import_sdk
    params: { sdk: '@anthropic-ai/sdk' }
  - rule: forbidden_pattern
    params:
      {
        pattern: "process.env.ANTHROPIC_API_KEY \\|\\| ['\"]",
        message: 'Do not fall back to a hardcoded key.',
      }

runtime:
  - rule: call_count
    params: { min: 2, max: 6 }
  - rule: tool_call_made
    params: { tool_name: 'fetch_account_balance', at_least: 1 }
  - rule: tool_error_handled
    params:
      tool_name: 'fetch_account_balance'
      retry_pattern: 'exponential'
      max_retries: 3

behavior:
  enabled: false
```

For the rare open-ended lab:

```yaml
behavior:
  enabled: true
  judge_model: 'claude-opus-4-7'
  rubric_file: 'rubric.md'
  pass_threshold: 0.7
```

## Why

- **Static + runtime** covers the deterministic 90% of labs. Marcus's complaint with most ed-tech grading is "I did the right thing and it told me I didn't." Determinism solves that.
- **Behavior tier** is reserved for labs where the open-endedness is the point — and we're transparent that those labs use Claude-as-judge, with the rubric shown to the learner. No black box.
- **YAML rules** mean lab authors don't write code to grade — they pick from a library of predicates. This is the same lesson KodeKloud and AI21 Labs hit: graders should be declarative.

## Alternatives considered

- **Pure behavior-grading (Claude as judge always).** Rejected. Slower, non-deterministic, expensive, and learners don't trust judges they can't see.
- **Pure static analysis.** Rejected. Misses the runtime correctness that's the whole point of a real-API lab.
- **Test-suite-only (run learner code against unit tests).** Rejected for most labs because we want to verify the _Claude API interaction shape_, not just the function output.

## Consequences

- We need a `validate-engine` service that reads `validate.yml`, queries the proxy logs, runs the static checks, optionally invokes the judge, and returns structured pass/fail.
- We need a published library of validation rule names with documentation, because lab authors will need to know what's available.
- We need a way to test that a `validate.yml` itself is correct — a CI step that runs each lab's reference solution and asserts the validator passes on it.

## Open follow-ups

- Define the v1 rule library. Working list of ~25 rules, sufficient for ~90% of labs.
- Decide whether learners can see the validator's pass/fail per rule, or only an aggregate. (Lean: per-rule visible. Marcus wants to know exactly what failed.)
- Decide how strict to be on "exactly one call" assertions when SDK retries silently — likely we count post-retry.
