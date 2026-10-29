---
date: 2026-10-29
slug: dev-engine-d3b-plan-solidification
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#30
---

# engine/plan-solidification.mjs: deterministic scoring + solution doc (spec/005 stage 5, PR-D3b)

## Summary

Fourth PR of stage 5, following D1 (carrier, `#27`), D2 (invoker, `#28`), and D3a (review panel tier selection, `#29`). Adds `engine/plan-solidification.mjs` — the scoring and document-rendering half of step 2's "逐个 issue 多 agent 评审，选最优方案并固化" (per-issue multi-agent review, pick and solidify the best proposal).

## What this adds

- `totalScore(scores)` — sums a proposal's per-reviewer-perspective scores.
- `pickBestProposal(proposals)` — the highest total wins, in deterministic code (RULE 3: the LLM proposes and reviews; code does the arithmetic and picks the max — never the other way around). Ties break toward the first-listed proposal: spec/005 names no tie-break rule, so this is a documented default rather than an assumption smuggled in silently. A real tie across ≥3 independent reviewer perspectives should be rare; if the runner hits one often enough in practice to matter, that's worth surfacing on its own rather than quietly living with this default forever.
- `renderSolutionDocument(...)` — produces the `issue-<n>-solution.md` content step 2 says to output: a score table (every proposal × every reviewer perspective × total), the winning proposal's summary, and a rejected-proposals section listing every non-winning proposal. On a Lite-tier single-proposal issue (no rejected alternatives to show), it says so explicitly rather than leaving an empty, ambiguous section.

## Mutation-style verification

- `pickBestProposal`: changed the comparison from `score > winnerScore` to `score >= winnerScore`. Result: exactly the one test asserting a tie breaks toward the first-listed proposal went red (10 pass / 1 fail) — a `>=` comparison would silently let a later equal-scoring proposal win instead, the opposite of the documented tie-break rule. Reverted.

Back to fully green after restoring.

## Known gaps, stated rather than hidden

- The "薄 issue"（thin issue）panel-derived-acceptance-criteria marker that section 2.1 describes ("由评审小组推导验收标准并标注「小组推导」，写进方案和 PR 正文") is not yet threaded through `renderSolutionDocument`. It belongs here conceptually, but needs a concrete call site to design against rather than a speculative field — deferred to whichever of stage 6/7 first assembles a real solution document, to avoid guessing at a shape with no caller yet.
- Score validation/clamping is explicitly out of scope: this module assumes the REASON-side structured-output schema (not yet built) already constrains each reviewer's score to a known range, and only sums and compares what it's given.

## Test result

```
engine/plan-solidification.test.mjs: 11/11
```

Plus all 251 other pre-existing engine/issue-pipeline tests (D1, D2, D3a, and everything from stage 4), reconfirmed green. `check-version-bump.mjs` (`5.16.0 → 5.17.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally.

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None to any existing repo — nothing calls this module yet |
| Rollback        | Revert the PR                                             |

## Next

D3c: the reasoning-layer eval suite skeleton (case files only — no `claude plugin eval` run in this PR; that will be flagged and quoted separately before any run, per the standing cost-disclosure note from D1/D2/D3a's revision docs). That closes out stage 5's own scope (section 4's "改动" list); the eval suite's actual run, against section 6 criterion #11's bar, happens after D3c merges.
