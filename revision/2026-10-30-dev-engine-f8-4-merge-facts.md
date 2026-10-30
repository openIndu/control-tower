---
date: 2026-10-30
slug: dev-engine-f8-4-merge-facts
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#47
---

# engine/merge-facts.mjs (spec/005 stage 7, PR-F8-4)

## Summary

Fourth of stage 7's final sub-PRs (F8). `runStep4` (F5, `#41`) needs a real `gatherPromotionFacts`/
`gatherPostPromotionFacts` callback supplying every merge guard's inputs. This PR adds that
fact-gathering — composing fresh `gh`/`git` reads, not duplicating any guard-evaluation logic.

## What this PR changes

`plugins/openindu-control-tower/engine/merge-facts.mjs`: `gatherMergeFacts(context, internalFacts,
deps)`. Composes `gh pr view` + REST `pulls/{n}/files` (G1,G2,G4,G5,G7), `commits/{branch}` +
`commits/{branch}/status` (G8), `git merge-base --is-ancestor` (PR/default-branch ancestry and G11's
`principle_ref` check), `git diff` + `git patch-id --stable` (G1,G4), `gh api contents/.github/CODEOWNERS`
(G9), and `route-reader.mjs`'s live route/SKILL.md reads, fail-closed on error (G11).

Two stated data-source gaps: `baseCoverageThresholds`/`headCoverageThresholds` default to `{}` (no
schema field yet for per-repo coverage config); `moduleBoundariesTouched` is a documented heuristic
(distinct top-level path segments), not a verified-correct algorithm.

## Test result

11 tests, all passing, including a mutation check on the ancestry argument order.

```
node --test plugins/openindu-control-tower/engine/merge-facts.test.mjs
# tests 11, pass 11, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                |
| --------------- | --------------------------------------------------- |
| Behavior change | None — new file, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                       |
| Plugin version  | Unchanged (`5.19.0`)                                |
| Rollback        | Revert the PR (new file only)                       |

## Next

Remaining F8 work is wiring the real implement/review-fix and local-service/build callbacks, then the
final assembly sub-PR.
