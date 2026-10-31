---
name: dev
description: Run the deterministic org-wide /dev pipeline against one repo's open issues — scope, implement, review, PR, and (when authorized) merge, entirely in script logic with zero ad hoc agent judgment over GitHub writes. Use when the user wants to drive a repo's issue backlog through this pipeline, confirm a run's merges (`ack`), or build a repo's release image (`build`).
argument-hint: "<repo> [--dry-run] [--resume RUN_ID] [--no-merge] [--max-issues N] [--max-total-budget-usd N] | ack <run-id> | build <repo> [--confirm]"
disable-model-invocation: true
---

# /dev — org-wide deterministic issue pipeline

The entire pipeline (route/grant reads, admission, guards G1–G11, the state machine, CI
classification, carrier invocation, merge execution, circuit breaker, rollback detection) is
**script logic**, not agent judgment — `plugins/openindu-control-tower/engine/` and
`skills/dev/scripts/dev.mjs`. This skill's own job is only to invoke that runner with the right
arguments and relay its result; it never reimplements, second-guesses, or bypasses any of that
logic from inside a conversation. Call `/principle` first.

`./dev <repo>` (the workspace's own thin launcher, not tracked in this repo — see spec/005 section
2.1) and `/dev <repo>` (this skill) invoke the same script. `disable-model-invocation: true` means
nothing in a conversation triggers this on its own; it only runs when the user types `/dev`.

## Invocation

Default repo-run mode:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dev/scripts/dev.mjs" --repo <repo> [--org openIndu] \
  [--dry-run] [--resume <run-id>] [--no-merge] [--max-issues <n>] [--max-total-budget-usd <n>]
```

PowerShell:

```powershell
node "$env:CLAUDE_PLUGIN_ROOT/skills/dev/scripts/dev.mjs" --repo <repo> `
  [--dry-run] [--resume <run-id>] [--no-merge]
```

Subcommands:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dev/scripts/dev.mjs" ack <run-id>
node "${CLAUDE_PLUGIN_ROOT}/skills/dev/scripts/dev.mjs" build <repo> [--confirm]
```

- `--dry-run`: stops after step 2 (scoping + proposal + review), produces a solution document per
  issue, zero GitHub writes. Cannot be combined with `--resume`.
- `--resume <run-id>`: continues a prior run from its saved `state.json`, re-using the same
  run-id's worktrees and skipping any issue step already completed (never re-opens a PR or
  re-merges one that already merged).
- `--no-merge`: opens and reviews PRs but stops before merge, regardless of whether the repo has a
  valid `dev_grants` entry.
- `--max-issues <n>` (default 10), `--max-total-budget-usd <n>` (default unlimited, shared across
  the whole run, not per issue).
- `ack <run-id>`: the `approved_by` maintainer confirms a run's merges, in an interactive terminal,
  under the matching `gh` login. Run this yourself — it refuses outside an interactive terminal or
  under a different login, and the model cannot satisfy either requirement on your behalf.
- `build <repo> [--confirm]`: reports this repo's step-6 build readiness; only attempts a real
  build when `--confirm` is passed AND readiness is `READY_TO_BUILD`. There is no real
  `runAggregateRelease` implementation in this repo yet (that mechanism belongs to the aggregate
  repo) — a confirmed, ready build fails loudly with a clear "not implemented" error rather than
  fabricating a result.

## Reading the result

The runner prints one JSON object and sets its own process exit code (0 `OK`, 1
`ARGUMENT_OR_INTERNAL_ERROR`, 2 `PARTIAL`, 3 `REJECTED`, 4 `CIRCUIT_BREAKER`, 5
`ENVIRONMENT_CHECK_FAILED` — `reference/dev.schema.json`'s `$defs.exitCode`). Relay it to the user
rather than re-deriving a verdict from its fields yourself:

- A real run's `outcome: "RUN_COMPLETE"` carries `report` — the already-rendered markdown
  acceptance matrix, rates, and Complete/Partially-complete verdict (spec/005 section 6 criteria
  #15/#16). Show that text to the user as-is; do not write a second summary that could drift from
  what it says.
- `outcome: "REJECTED"` means admission (A1–A3) or `dev.enabled` rejected the whole run before any
  issue was touched — report `reason` plainly, this is not a partial failure.
- `outcome: "RUN_LOCKED"` means another run already holds this repo's lock; do not retry in a
  loop.
- A non-`RUN_COMPLETE`/`REJECTED` outcome (`ARGUMENT_ERROR`, `ACK_REJECTED`, a `BUILD_*` status)
  carries its own `reason` — surface it, do not paraphrase it into something more conclusive than
  it is.

## Boundary

This skill does not grant itself anything the runner's own guards would otherwise refuse. It never
merges without a live, unexpired `dev_grants` entry for the target repo (G11); never pushes to a
default branch (RULE 7); never edits K8s manifests (RULE 8); never writes production data (RULE
10); never claims a RULE 11 stage complete that the runner itself did not verify. A repo with
`dev.enabled` not `true` in `route.json` is rejected before this skill (or the runner) does
anything else.
