---
date: 2026-10-29
slug: dev-engine-d3a-review-panel
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#29
---

# engine/review-panel.mjs: complexity-scaled tier selection (spec/005 stage 5, PR-D3a)

## Summary

Third PR of stage 5, following D1 (`#27`, carrier) and D2 (`#28`, invoker). Adds `engine/review-panel.mjs`, implementing section 2.2's complexity-scaled review panel: tier selection by deterministic rule, LLM-escalate-only override, and the L3-action pre-check that keeps an issue out of implementation entirely. `plan-solidification.mjs` (the scoring/document half of the same spec paragraph) is split into a follow-up PR (D3b) — the two together total 445 lines across what turned out to be two separable concerns (tier selection vs. scoring and rendering), over section 4's 400-line limit.

## What this adds

- `TIERS` / `PANEL_COMPOSITION` — section 2.2's table verbatim: Lite (1 proposal, 1 reviewer at each stage), Standard (3 proposals across 3 named strategies, 3 plan reviewers, 4 implementation reviewers), High-risk (Standard plus a security challenger and a test challenger, contract-first).
- `requiresHumanForL3Action(declaredActionTypes)` — section 2.3's pre-check: an issue declaring a prod-deploy / data-deletion / permission-change / secret-change / prod-SQL action never enters tier selection or implementation at all (plan still solidifies; the runner just doesn't act).
- `baselineTier(...)` — the deterministic baseline from signals the proposal itself declares (module count, risk tier, estimated lines, docs/config-only, a caller-computed `touchesSensitiveArea` flag). Reuses the org's existing L0-L3 risk scale (`guards-core.mjs` already has this exact concept under a different name; duplicated here as 3 lines rather than imported, since tier selection and merge-guard evaluation are different concerns and the scale itself is stable).
- `applyLlmTierSignal(...)` — the LLM's own signal can only move the tier up, never down; a stated-uncertain review or confidence below 0.80 overrides tier selection entirely and returns `"human"` rather than any tier, reusing `/issue-pipeline`'s existing threshold named explicitly in the spec text.

## Mutation-style verification

- `applyLlmTierSignal`: replaced the escalate-only `Math.max` resolution with `return suggestedTier` directly (allowing a downgrade). Result: exactly the one test asserting a lower suggested tier is ignored went red (19 pass / 1 fail). Reverted.

Back to fully green after restoring.

## Known gaps, stated rather than hidden

- The tie-break when `baselineTier` and an escalation signal interact at the boundary (e.g. confidence exactly at 0.80) is tested at the documented boundary (`0.80` does not escalate, `0.79` does) but not exhaustively fuzzed.
- `touchesSensitiveArea` is accepted as a caller-supplied boolean rather than computed here. The caller is expected to reuse `path-rules.mjs`'s `changedProtectedPaths` for the path half of section 2.2's High-risk criteria (auth/secrets/CI-config/migrations/public-API-contract) — this module has no filesystem or path logic of its own, by design.

## Test result

```
engine/review-panel.test.mjs: 20/20
```

Plus all 231 other pre-existing engine/issue-pipeline tests (D1's `proxy.test.mjs`, D2's `invoker.test.mjs`, and everything from stage 4), reconfirmed green. (`plan-solidification.test.mjs`'s 11 are drafted alongside this PR but held for D3b, so not counted here.) `check-version-bump.mjs` (`5.15.0 → 5.16.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally.

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None to any existing repo — nothing calls this module yet |
| Rollback        | Revert the PR                                             |

## Next

D3b: `plan-solidification.mjs` (deterministic score aggregation + `issue-<n>-solution.md` rendering — already drafted and tested). D3c: the reasoning-layer eval suite skeleton (case files only; running `claude plugin eval` against them is out of scope for D3 and will be flagged separately before any run, per the standing cost-disclosure note from D1/D2's revision docs).
