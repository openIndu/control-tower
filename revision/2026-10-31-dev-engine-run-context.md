---
date: 2026-10-31
slug: dev-engine-run-context
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#62
---

# F8-16: run-context -- repo-level runContext fields resolved once per run

## Summary

`buildRealStep4Deps`'s `runContext` parameter (#60) needs `authorizedApprovers`, commit config,
and `publishesOnMerge` -- repo/run-level facts a per-issue loop should resolve once per repo
rather than redoing on every issue.

## What this PR adds

`buildRepoRunContext(args, {resolveApprovers})`: reads commit config and `publishesOnMerge` from
`repoEntry.dev` using `dev.schema.json`'s exact field names, resolves `authorizedApprovers` via
one injected call, and initializes circuit-breaker facts to their safe starting state.

Deliberately excludes `resumePrNumber` -- that field varies per issue, so the per-issue loop (not
yet built) must override it fresh on each call rather than inherit a run-wide value.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 456, pass 456, fail 0
```

5 new tests, including one asserting `resumePrNumber` is absent from the returned object.

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

`main()`'s per-issue loop itself: clone the repo, create each issue's worktree, build its carrier
callbacks (#61) and per-issue `runContext` override, call `runIssuePipeline` with `#60`'s
`buildRealStep4Deps`, and accumulate results. Budget/trace wrapping, circuit-breaker counter
tracking across iterations, resume, step 5/6 sequencing, and the final report follow in later
PRs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
