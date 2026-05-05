# Design Identity

> Marcus is the audience. He has 25 minutes to himself between meetings. He does not want to be charmed.

## Brand attributes

Density. Scenario-first. No condescension. Built by practitioners.

If KodeKloud feels like a friendly bootcamp coach, this feels like a senior staff engineer who values your time. Direct, technical, lightly opinionated. The product respects that the learner already has 20 years of pattern-matching — it doesn't waste any of it.

## Voice and tone

**Principles:**

1. **State the scenario, then the task.** No throat-clearing.
2. **Use the right technical word.** "Agent topology," not "AI workflow design." "Idempotent retry," not "trying again safely."
3. **Show, don't celebrate.** No "Great job! You completed step 2!" — the next step appears.
4. **Be opinionated.** When there's a right answer, say it. When there are tradeoffs, name them.
5. **Acknowledge the exam without obsessing over it.** This is exam prep, but the product isn't a cram course. The labs teach the actual practice.

**Concrete copy examples:**

| Good                                                                                                                                                                 | Bad                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| "Design an agent topology for a FINRA-regulated trade-flagging workflow. Your design will be evaluated on tool isolation, audit logging, and failure-mode coverage." | "Welcome! In this exciting lab, you'll learn how to build agents — let's get started!" |
| "This implementation leaks PII into prompt cache headers. See line 34."                                                                                              | "Oops! Looks like there might be a small issue with your code. Take another look!"     |
| "You haven't passed Domain 4 mocks at >75% in 14 days. Consider revisiting Tool Design before sitting the real exam."                                                | "Don't give up! You're so close! Try again!"                                           |
| "Mock exam 3 graded: 742/1000. Weakest domain: Context Management (62%). Recommended labs: 4.3, 4.6, 4.9."                                                           | "Congratulations on finishing! Here's your score!"                                     |
| "MCP boundary should sit at the trust boundary — service A and service B don't share a tenant, so the tool definition crosses too much."                             | "There may be a better way to organize your MCP server!"                               |

**Forbidden words at launch:** "amazing," "awesome," "exciting," "let's," "journey," "unlock," "level up," "boost," "supercharge," "AI-powered" (we ARE Claude, we don't need to brag).

## Visual language

**Color palette:**

- Background: near-black `#0E0E0E` (matches Claude's brand) or a soft warm white `#FAFAF7` for light mode. Default to dark.
- Primary: a single accent color, used sparingly. Working choice: `#D97757` (Claude's terracotta) or a tighter graphite-orange. The accent appears on CTAs, score badges, and the active tab — nowhere else.
- Status colors: muted, not loud. Green `#2D6A4F` for pass, amber `#B7791F` for partial, red `#9B2C2C` for fail. No emoji, no checkmarks-with-confetti.
- Text: high contrast. Never gray-on-gray. The lowest-priority text is still 70% opacity, never 40%.

**Typography:**

- Sans-serif body: Inter or IBM Plex Sans. 15–16px. Generous line-height (1.6).
- Monospace: JetBrains Mono or IBM Plex Mono. Used for code, terminal, model names, API parameters — not as decoration.
- Headings: same font as body, semibold. No display fonts. No serifs.
- We do not use bold for "emphasis." We use bold for hierarchy.

**Density:**

- A lab page shows: scenario brief (left third), editor + terminal (center), validation panel (right third). All visible at once on a 1440px display. No accordions, no "click to expand." Marcus has the screen real estate.
- Default code editor: dark theme, 14px, line numbers, 100-char ruler.
- Whitespace is for separation, not breathing room. Tight padding (16px sections), generous line-height inside text.

**Layout:**

- Three primary regions per lab: brief, workspace, validation.
- Top bar is small (44px) with: product mark, current track + lab number, exam-readiness score, account.
- No left sidebar inside a lab. The dashboard has a sidebar; the lab does not (that real estate goes to scenario + workspace).
- Persistent "Solution" button, always visible, always one click away. Marcus may want to peek. We don't guilt him.

## Component hierarchy

The five components that matter most, in priority order:

1. **Scenario Brief** — the most important component on the platform. Renders markdown with embedded code, system architecture diagrams (mermaid), and constraints/success criteria sections. Always-on left rail in a lab.

2. **Workspace** — Monaco editor + xterm.js terminal in a split pane. The editor is wired to a per-session container with the Claude SDK pre-installed, an environment variable for the proxied API key, and a starter file.

3. **Validation Panel** — three sections: Static checks, Runtime checks, Behavior checks (see ADR-0002). Each shows pass/fail with a one-line reason. No "you got it!" — just the result.

4. **Mock Exam Engine** — full-screen, single-question-at-a-time, timer in top-right, mark-for-review flag, navigator at the end. Mirrors a real Pearson VUE / proctored UI as closely as possible without the proctor camera.

5. **Readiness Dashboard** — a single page, no tabs. Shows exam-readiness % per domain, weighted to match CCA-F. Recommended next lab. Time-to-ready estimate based on completion velocity.

The five components that don't exist:

- Newsfeed / activity stream.
- Comments / discussion threads inline.
- Gamification widgets (streaks, points, levels, leaderboards).
- "Suggested for you" carousels.
- Onboarding wizards. Marcus drops into the first lab in <60 seconds.

## Naming

**Working name:** `ClaudeKloud`. Almost certainly trademark-blocked or close enough to it that we can't ship it. Placeholder only.

**Naming criteria for the real name:**

- Not a portmanteau of "Claude" + something else. Anthropic's marks will eat us.
- Pronounceable in English on the first try.
- One word, two syllables.
- A `.com` exists or a creative `.ai` / `.dev` works.
- Doesn't sound like a bootcamp. Marcus needs to feel okay listing it on his LinkedIn.
- Doesn't have "AI" in the name. Everything has AI in the name.

**Working alternatives** (do not commit yet): `Topology`, `Anvil`, `Crucible`, `Argot`, `Praxis`, `Tenet`. All evoke practice, weight, depth.

## Tone in error states

Errors and failures are where most products betray their values. Ours stay direct.

| Situation               | Bad                                            | Good                                                                                                           |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Lab failed validation   | "Hmm, something's not quite right!"            | "Validation failed: the agent loop doesn't handle tool errors. See validation panel."                          |
| Sandbox spin-up timeout | "Just one moment while we get things ready..." | "Sandbox failed to start. Retrying. If this persists, the lab may be temporarily unavailable."                 |
| Stripe payment fails    | "Oops! There was a problem."                   | "Payment declined. Try a different card or contact your bank — we don't have more detail than your bank does." |
| Mock exam time runs out | "Time's up! Great effort!"                     | "Time elapsed. Your answers up to this point are submitted. Score: 684. Per-domain breakdown below."           |

## Anti-patterns

Things we explicitly will not do, ever:

- Confetti animations.
- Loading messages with personality ("Brewing your sandbox...").
- "We noticed you've been away — come back!" emails.
- Push notifications.
- Mascot.
- A character who talks to the learner. We are not your AI buddy.
- Auto-playing videos.
- Dark patterns on cancellation. The "cancel subscription" button is one click from the account page.
- AI-generated stock illustrations of brains, neurons, robots, or hands shaking with circuit patterns.

## What this means for the brand mark

A mark, not a logo. Single color. Works at 16px favicon and 200px landing-page hero. Either a wordmark in the body sans-serif or a single geometric glyph. No gradients, no AI-shimmer effects, no isometric stack of cubes.
