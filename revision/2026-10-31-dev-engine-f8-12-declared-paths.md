---
date: 2026-10-31
slug: dev-engine-f8-12-declared-paths
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#55
---

# Proposal self-declares its touched paths, for guardG4 (spec/005 stage 7, PR-F8-12)

## Summary

Twelfth of stage 7's final sub-PRs (F8). Found while researching how `dev.mjs`'s `main()` will
assemble the real `buildStep4Deps`: `guardG4` (already built and tested in an earlier stage)
compares the PR's actual changed paths against `declaredPlanPaths`, but nothing anywhere supplied
a real value for it.

## What this PR changes

`guardG4` (`guards-core.mjs`) checks that a PR's changed paths stay inside the plan's declared
scope -- a pre-declared boundary, deliberately independent of the diff it is checked against
(otherwise the guard would be vacuous: comparing the same data to itself always "matches").
Neither `PROPOSAL_SCHEMA` nor `SCOPING_SCHEMA` in `carrier-callbacks.mjs` asked the carrier to
declare which paths a solution would touch, so there was no real source for `declaredPlanPaths`
anywhere in the pipeline.

Added `declaredPaths` to `PROPOSAL_SCHEMA` (now required alongside `summary`) and to
`buildRealGenerateProposal`'s prompt text. A winning proposal is "the plan" step 2 solidifies
into, and `plan-solidification.mjs`/`implement-review.mjs` already pass a proposal through by
reference with no exact-shape check on it (confirmed by reading both test files) -- so this field
reaches step 4's real `buildStep4Deps` as `winningProposal.declaredPaths` with no other module
needing to change.

Confirmed safe to extend: `jsonSchema` is only ever serialized into a CLI arg
(`carrier/invoker.mjs`'s `--json-schema`), never asserted against by content in any test, and no
existing test does an exact-shape `deepEqual` on `buildRealGenerateProposal`'s return that would
need `declaredPaths` added to it.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 430, pass 430, fail 0
```

1 new test: the prompt asks for `declaredPaths`, and propagates whatever the carrier returns for
it.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed -- `engine/` only).

## Impact

| Scope           | Note                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| Behavior change | Additive: `declaredPaths` added to `PROPOSAL_SCHEMA` and its prompt text  |
| Blast radius    | `openIndu/control-tower` only                                             |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only, not distributed `skills/` content |
| Rollback        | Revert the PR -- additive only                                            |

## Next

Still researching (a forked background pass) the remaining `internalFacts` fields
`buildStep4Deps` needs: `reviewedSha`/`ciEvaluatedSha`/`reviewedPatchId` (guardG1), and the G9/G10/
G11-related fields (`authorizedApprovers`, `acceptanceCriteriaCrowdDerived`,
`reviewExpressedUncertainty`, `confidence`, `riskTier`, `priorRiskTier`, `snapshotBodyHash`), plus
`git-ops.mjs`'s exact `commit` shape and `carrier/invoker.mjs`'s exact `carrier` config shape.
Once that lands, the real `buildStep4Deps` wrapper itself, then the per-repo loop, resume, the
acceptance-matrix report, `./dev ack`/`./dev build`, `SKILL.md` + launchers, and the closing
acceptance sweep against spec/005 §6's 20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
