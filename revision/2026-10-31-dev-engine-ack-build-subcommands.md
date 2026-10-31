---
date: 2026-10-31
slug: dev-engine-ack-build-subcommands
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#69
---

# F8-23: wire ./dev ack and ./dev build subcommand dispatch

## Summary

`ack.mjs` and `build-step.mjs`'s `runBuildStep` were both already built and tested, but nothing
ever called either one -- `main()`'s argument parsing only supported the default repo-run mode.
This wires both subcommands per spec/005 section 2.1's signatures: `./dev ack <run-id>` and
`./dev build <repo> [--confirm]`.

## What this PR adds

`main()` detects `argv[0] === "ack"/"build"` before calling the existing `parseArgs`, so the
default mode's argument parsing is untouched. `runAckCommand` scans every repo's `dev-runs`
directory for a matching run-id (the subcommand takes only a run-id, not `--repo`), reads the
matching `dev_grants` entry's `approved_by`, and acks every merged-but-unacked issue in that run
once the current `gh` login and an interactive terminal are confirmed. `runBuildCommand` resolves
the repo's `dev.build` and calls `runBuildStep` with the same `rule11Status: undefined` reasoning
as `runRepo`'s own step-6 wiring; its `runAggregateRelease` default throws a clear "not
implemented" error rather than fabricating a build, since that mechanism is explicitly out of
scope for control-tower per `build-step.mjs`'s own header comment.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 514, pass 514, fail 0
```

15 new tests. Mutation-checked 5 points -- each broke exactly its predicted test(s); reverted.
Smoke-tested the real CLI entry point's `--help`/`ack`/`build` paths.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Behavior change | `./dev ack`/`./dev build` are now real, dispatchable subcommands         |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today |
| Plugin version  | `5.26.0` -> `5.27.0`                                                     |
| Rollback        | Revert the PR                                                            |

## Next

`SKILL.md` + workspace launchers (owned by the workspace, not this repo); CI wiring; the closing
acceptance sweep against all 20 rows of spec/005 section 6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
