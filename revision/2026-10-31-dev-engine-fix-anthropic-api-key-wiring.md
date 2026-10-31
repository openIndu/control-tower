---
date: 2026-10-31
slug: dev-engine-fix-anthropic-api-key-wiring
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#56
---

# Fix: ANTHROPIC_API_KEY was never wired into the real carrier invocation

## Summary

A correctness bug fix, found while researching `dev.mjs`'s `main()` wiring (a forked background
research pass reading `carrier/invoker.mjs` and `carrier/run-agent.mjs` together). `buildAgentEnv`
built a carefully-curated env object -- including `ANTHROPIC_API_KEY` -- but nothing in the real
invocation path ever passed it anywhere. As merged, every real carrier invocation would fail to
authenticate at all.

## What this PR changes

`buildDockerComposeRunArgs` never added `ANTHROPIC_API_KEY` to `composeArgs`.
`carrier/run-agent.mjs`'s `defaultSpawnCompose` never passed an `env` option to `spawnSync`.
`docker-compose.yml`'s `agent` service correctly declares the other 5 non-secret vars statically
(`HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `OPENINDU_DEV_ACTIVE`,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`), but cannot hardcode a secret as a literal in a
checked-in file.

Fix: `buildDockerComposeRunArgs` now adds a bare `-e ANTHROPIC_API_KEY` (no `=value`) to
`composeArgs`, before the service name (Docker Compose's own `run [OPTIONS] SERVICE` argv order
requires options before the service). A bare `-e NAME` tells `docker compose` to forward the
value from its own process environment -- the secret's actual value never appears in
`composeArgs`, a log line, or a test fixture. `spawnSync` already inherits `process.env` by
default when no `env` option is given, so the only remaining precondition is that the Node
process running `dev.mjs`'s `main()` has `ANTHROPIC_API_KEY` set in its own environment.

`buildAgentEnv` is now genuinely dead (the 5 non-secret vars it built are already declared
statically in `docker-compose.yml`; the one field it uniquely added needs no JS-side threading at
all under the bare-flag approach) -- deleted it and its dedicated test.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 430, pass 430, fail 0
```

Fixed 2 pre-existing exact-shape `composeArgs` assertions this touches, added 1 dedicated test.
Mutation-checked: reverting the `composeArgs` change turned exactly these 3 tests red (2 in
`invoker.test.mjs`, 1 in `carrier-callbacks.test.mjs`), reverted back to green.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed -- `engine/` only).

## Impact

| Scope           | Note                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| Behavior change | Fix: `composeArgs` now carries `-e ANTHROPIC_API_KEY`. Removed: dead `buildAgentEnv` |
| Blast radius    | `openIndu/control-tower` only; nothing live calls this invocation path yet           |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only, not distributed `skills/` content            |
| Rollback        | Revert the PR -- restores the (broken) prior state, not a regression risk either way |

## Next

Continuing the `buildStep4Deps` research/design (field-sourcing map from the same forked research
pass): most `internalFacts` fields resolve to pure reuse of already-built modules (snapshot
source-permission facts, `resolveTier`'s `scoping` object, `git-ops.mjs`'s already-exported
`currentCommitSha` for G1's `reviewedSha`/`ciEvaluatedSha`) or simple field-name renames.
Remaining genuine gaps: `extraProtectedPatterns` (likely defaults to `[]`), `priorRiskTier`
(design question: cross-run persisted state, or just this issue's own already-resolved tier from
step 1 -- needs `guardG6`'s exact semantics confirmed), `authorizedApprovers` (no existing source
found anywhere), `currentBodyHash` (needs a small fresh-refetch function), and
`acceptanceCriteriaCrowdDerived` (likely a caller judgment call, not a fetchable fact). Also still
need to confirm whether `pr-lifecycle.mjs`'s `runCiRetryLoop` re-commits before re-polling during
a CI-fix round, which affects how `reviewedSha`/`ciEvaluatedSha` should be tracked across retries.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
