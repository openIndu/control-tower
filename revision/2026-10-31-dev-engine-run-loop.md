---
date: 2026-10-31
slug: dev-engine-run-loop
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#63
---

# F8-17: runRepo -- real per-issue loop wiring steps 2-4 end to end

## Summary

`main()` was still printing `runIntake`'s raw step-1 result. This wires the next stage: for every
open issue (up to `--max-issues`, default 10), clone the repo once, set up the one shared system
prompt (#61), then call `issue-pipeline.mjs`'s `runIssuePipeline` with `carrier-setup.mjs`'s real
per-issue carrier callbacks (#61) and `real-step4-deps.mjs`'s real `buildStep4Deps` (#60), via
`run-context.mjs`'s resolved repo-level context (#62).

## What this PR adds

`runRepo(options, overrides)`: `stopAfterCiGreen = options.noMerge ||
!resolveRepoAuthorization(route, repo).authorized`. Each issue gets its own `promptDir` (a sibling
of its worktree, never shared across issues -- `buildRealGenerateProposal` names its prompt file
only by strategy, with no issue number, so sharing would risk collisions). Exit code selected via
`exit-codes.mjs`'s `exitCodeForStates` across the batch.

`docs-dir.mjs` gains `resolveRepoDocsDir` (the repo-level parent of `resolveDocsDir`'s run-scoped
path) -- `.dev-pause` must be visible across every run for a repo, not scoped to one run-id.

`runIntake` now also returns `route` and `defaultBranch` (both already computed internally) --
confirmed safe, no existing test does a full-object `deepEqual` on its result.

## Stated gaps

`--dry-run` (refused explicitly, not silently honored), `--max-total-budget-usd` / trace-log
persistence, run-state / lock / `--resume`, step 5/6 sequencing + final report. All follow-ups.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 466, pass 466, fail 0
```

14 new tests. Mutation-checked: `--dry-run` guard, both directions of `stopAfterCiGreen`, and the
`--max-issues` slice bound -- each broke exactly its predicted test(s); reverted.

Also passing: `prettier --check "**/*.md"` (repo gate) plus every changed file individually,
`claude plugin validate --strict`, `sync-route.mjs --check`, `check-roster.mjs`.

## Impact

| Scope           | Note                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Behavior change | `main()` now runs the real pipeline instead of stopping after intake                                 |
| Blast radius    | `openIndu/control-tower` only; unreachable for any real repo today (no `dev.enabled: true` anywhere) |
| Plugin version  | `5.20.0` -> `5.21.0` -- first PR in this series touching `skills/dev/scripts/dev.mjs` itself         |
| Rollback        | Revert the PR; `runIntake`'s added fields are additive and harmless to keep either way               |

## Next

Run-state persistence + lock + `--resume`; `--max-total-budget-usd`/trace-log wrapping around the
carrier callbacks; `--dry-run`'s stop-after-step-2 mode; step 5/6 sequencing; the final report;
`./dev ack`/`./dev build` subcommand wiring; `SKILL.md` + workspace launchers; CI wiring for all
new test files; the closing acceptance sweep against spec §6's 20 rows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
