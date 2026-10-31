---
date: 2026-10-31
slug: dev-engine-fix-declaredpaths-scoping-passthrough
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#57
---

# Fix: declaredPaths/scoping were dropped before reaching step 4

## Summary

While extending `issue-pipeline.mjs` to pass `declaredPaths`/`scoping` to `buildStep4Deps` (the
next piece needed for `guardG4`/`guardG6`), an integration-level assertion in the happy-path test
(rather than trusting each module's isolated unit tests in sequence) caught a real bug:
`proposal-review.mjs`'s `runProposalStage` silently dropped `declaredPaths` before it ever reached
a winning proposal.

## What this PR changes

`runProposalStage` destructured only `summary` out of `generateProposal`'s result and discarded
everything else, including `declaredPaths` (added in #55). The earlier PR's "no other module needs
to change" conclusion only checked that no test would _break_ from the schema addition -- it did
not check whether the field actually _survives_ `proposal-review.mjs`'s own construction. It
doesn't.

Fix: `runProposalStage` now also carries `declaredPaths` through, conditional on presence (same
shape as `carrier-callbacks.mjs`'s `costUsd`/`rawStdout` merges, for the identical reason:
confirmed directly that an unconditional assignment breaks the pre-existing exact-shape test).

`issue-pipeline.mjs`'s `buildStep4Deps` call now also passes `scoping` (`resolveTier` already
returns this; the call site previously kept only `.tier`) and `declaredPaths` (from the now-fixed
`step2Result.winner`). Both stay `null` on resume -- confirmed safe by reading
`pr-lifecycle.mjs`'s `POST_PROMOTION_GUARDS` list directly: G4/G6 are deliberately excluded from
the post-promotion recheck, so a `null` value here never reaches a guard that reads it on any
resume path.

Also cleaned up an accidental duplicated comment block in `issue-pipeline.mjs` from an earlier
`Edit` in #53 (dead duplicate prose, never a behavior bug).

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 431, pass 431, fail 0
```

1 new test in `proposal-review.test.mjs`, 2 new assertions added to `issue-pipeline.test.mjs`'s
existing happy-path test.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed).

Mutation checked: the conditional `declaredPaths` assignment, made unconditional, broke exactly
the 1 predicted pre-existing test; reverted.

## Impact

| Scope           | Note                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| Behavior change | Fix: `declaredPaths` now survives `runProposalStage`. Additive: `scoping` passthrough |
| Blast radius    | `openIndu/control-tower` only                                                         |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only                                                |
| Rollback        | Revert the PR -- restores the (lossy) prior state, no new regression either way       |

## Next

This closes the data-flow gaps #55's own research turned up. `buildStep4Deps`'s real
implementation (the module that assembles everything `step4-callbacks.mjs`'s
`buildStep4Callbacks` needs -- commit message, carrier config, PR title/body, and the full
`internalFacts` field map from the forked research pass) is next, followed by `main()`'s per-repo
loop, resume, the acceptance-matrix report, `./dev ack`/`./dev build`, `SKILL.md` + launchers, and
the closing acceptance sweep against spec/005 §6's 20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
