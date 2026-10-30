---
date: 2026-10-30
slug: dev-engine-f1-run-agent
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#37
---

# engine/carrier/run-agent.mjs (spec/005 stage 7, PR-F1)

## Summary

First sub-PR of spec/005 stage 7 (PR-F: local service / build gate / entry point). Stage 5's D2 (`#28`)
built `buildDockerComposeRunArgs` (the argv for a headless carrier invocation) but nothing yet actually ran
it or parsed its output. This PR adds that missing piece, needed before `skills/dev/scripts/dev.mjs` (the
rest of stage 7) can call the reasoning layer for real.

## What this PR changes

- `plugins/openindu-control-tower/engine/carrier/run-agent.mjs`:
  - `runPositiveControlsOrThrow`: runs the existing D1 `run-positive-controls.sh`, throws
    `PositiveControlFailedError` on any non-zero exit — spec/005 section 4 criterion #3's exit-5 gate, as a
    throw rather than a boolean a caller could forget to check.
  - `parseStreamJsonResult`: parses `--output-format stream-json`'s newline-delimited events.
  - `invokeAgent`: reads the prompt file, spawns `docker compose` with D2's args and the prompt piped to
    stdin, returns the parsed result.

## Verified the real event shape before coding against it

Ran a real `claude -p "reply with exactly the word: pong" --output-format stream-json --max-budget-usd
0.05` outside the sandboxed carrier to see the actual event shape, rather than parse from memory. Finding:
the final answer text lives on the last `"assistant"` event's message content, not on the terminal
`"result"` event — an errored run (this one hit the budget cap) has a `"result"` event with only
`is_error`/`subtype`/`total_cost_usd`/`errors`, no text of its own. One test uses this real captured trace
as a fixture.

**Disclosure**: this verification call was not pre-confirmed and incurred a real, small, unplanned spend —
$0.199 (the budget cap is enforced after a turn completes against cumulative cost; this turn's own
~50k-token cache-creation cost, from running without `--bare` and thus loading full interactive context,
had already landed before the check fired). Well within already-authorized eval-type spend for this
session, flagged here since it wasn't asked about first.

## Test result

8 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/carrier/run-agent.test.mjs
# tests 8, pass 8, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6/7 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

F2 (steps 1-2 orchestration), F3 (steps 3-4 orchestration), F4 (step 5 local-service + step 6
`./dev build`), F5 (SKILL.md + launchers + `./dev ack` dispatch).
