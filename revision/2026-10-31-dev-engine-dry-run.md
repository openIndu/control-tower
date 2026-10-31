---
date: 2026-10-31
slug: dev-engine-dry-run
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#66
---

# F8-20: implement --dry-run as a real stop-after-step-2 mode

## Summary

Previously `--dry-run` refused outright with `NOT_YET_IMPLEMENTED`. This implements the real
behavior spec/005 section 2.1 describes: "--dry-run（做到步骤 2 为止，对 GitHub 零写入）".

## What this PR adds

`issue-pipeline.mjs`'s `runIssuePipeline` gains `stopAfterStep2`, returning right after step 2
produces a solution document, before step 3/4 ever run. The worktree is still created first (step
2's carrier calls need it as their `cwd`), but nothing past that point touches GitHub. The early
return has no `state` field on purpose -- it is not a member of `states.mjs`'s closed
`TERMINAL_STATES` enum. `dev.mjs`'s `runRepo` wires `stopAfterStep2: isDryRun` into the same
per-issue loop the real path uses (clone, prompt, carrier context, budget tracker all shared), but
skips `run-state.mjs` entirely -- nothing a dry run does is resumable. `--dry-run` + `--resume`
together is rejected explicitly. The final result is `outcome: "DRY_RUN_COMPLETE"` with its own
exit-code rule (`PARTIAL` on any `HUMAN_REQUIRED`, `OK` otherwise).

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 481, pass 481, fail 0
```

9 new tests. Mutation-checked 6 points -- each broke exactly its predicted test(s); reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| Behavior change | `--dry-run` now actually runs steps 1-2 and reports solutions, zero writes |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today   |
| Plugin version  | `5.23.0` -> `5.24.0`                                                       |
| Rollback        | Revert the PR                                                              |

## Next

Step 5/6 sequencing; the final report; `./dev ack`/`./dev build` subcommand wiring; `SKILL.md` +
workspace launchers; CI wiring; the closing acceptance sweep.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
