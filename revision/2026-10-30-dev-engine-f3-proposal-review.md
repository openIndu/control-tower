---
date: 2026-10-30
slug: dev-engine-f3-proposal-review
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#39
---

# engine/proposal-review.mjs (spec/005 stage 7, PR-F3)

## Summary

Third sub-PR of spec/005 stage 7 (PR-F). Covers step 2's orchestration: generating N independent proposals
per the issue's tier, scoring each against that tier's reviewer perspectives, and solidifying the winner
into `issue-<n>-solution.md`.

## What this PR changes

- `plugins/openindu-control-tower/engine/proposal-review.mjs`:
  - `runProposalStage`: one `generateProposal(strategy, issue)` call per the tier's `proposalStrategies`
    (existing `review-panel.mjs`, D3a).
  - `runReviewStage`: one `reviewProposal(perspective, proposal)` call per proposal per the tier's
    `planReviewers`.
  - `solidifyPlan`: calls the existing `pickBestProposal` + `renderSolutionDocument` (D3b) — no logic
    duplicated.
  - `runStep2`: ties the three together for one issue.

`generateProposal`/`reviewProposal` are injected; the real carrier-invocation wiring is assembled later
when `dev.mjs` is written, keeping this module testable without Docker or spend.

## Sequential, not parallel

A documented default: spec/005's parallel bound covers how many issues' step 2 may run concurrently (≤3),
not proposal/reviewer-level parallelism within one issue.

## Test result

7 tests, covering all three tiers' exact proposal/reviewer counts (lite 1×1, standard 3×3, high-risk 3×5)
and that the winner is picked by score, not generation order.

```
node --test plugins/openindu-control-tower/engine/proposal-review.test.mjs
# tests 7, pass 7, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6/7 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

F4 (step 3), F5 (step 4), F6/F7 (steps 5/6), F8 (the actual `dev.mjs` entry point + SKILL.md + launchers).
