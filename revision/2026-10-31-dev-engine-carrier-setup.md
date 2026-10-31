---
date: 2026-10-31
slug: dev-engine-carrier-setup
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#61
---

# F8-15: carrier-setup -- run-level system prompt and callback wiring

## Summary

`main()`'s loop needs, once per run: a shared system prompt file and a factory producing all 6
real per-issue carrier callbacks `runIssuePipeline` needs. Both are pure composition of
already-built pieces from `carrier-callbacks.mjs` -- no new orchestration.

## What this PR adds

`setupSystemPrompt({controlTowerRepoPath, repoClonePath, promptDir})`: reads the principle
`SKILL.md` from the control-tower checkout plus the target repo's optional `CLAUDE.md`/
`AGENTS.md`, writes the combined text once, returns its path. Throws if the principle text
cannot be read -- RULE 1's anchor is non-optional, not something to default past.

`buildCarrierCallbacks(context, overrides)`: calls all 6 `buildReal*` functions with the same
shared context shape and bundles the results, threading `overrides` (notably `invoke`) through to
every one. `execShell` deliberately omitted -- `implement-review.mjs`'s own default already
covers it.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 451, pass 451, fail 0
```

4 new tests. Mutation checked: the principle-missing throw, disabled, broke exactly 1 predicted
test; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed).

## Impact

| Scope           | Note                                                          |
| --------------- | ------------------------------------------------------------- |
| Behavior change | Additive only -- new composition module                       |
| Blast radius    | `openIndu/control-tower` only; not wired into any entry point |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only                        |
| Rollback        | New files -- revert the PR                                    |

## Next

`main()`'s per-issue loop itself is next: the run-level context assembly (`authorizedApprovers`
resolved once per repo, `dev.commit`/`dev.publishes_on_merge` read from route.json, `docsDir` via
`resolveDocsDir`), the loop iterating `snapshot.issues` through `runIssuePipeline` with this
PR's callbacks plus #60's `buildRealStep4Deps`, circuit-breaker counter tracking across
iterations, budget/trace wiring, resume, and the final report.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
