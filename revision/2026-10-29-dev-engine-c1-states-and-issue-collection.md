---
date: 2026-10-29
slug: dev-engine-c1-states-and-issue-collection
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#20
---

# engine: terminal states, exit codes, and issue collection's --repo scope (spec/005 stage 4, PR-C1)

## Summary

First of four PRs implementing spec/005 stage 4 (the deterministic engine). Adds `plugins/openindu-control-tower/engine/`, a new library directory distinct from `skills/` (prompts) and the repo-root `scripts/` (control-tower's own self-checks) — it holds code the eventual `/dev` runner (stage 7) will import, operating on other repos. This slice covers only the two self-contained pieces: the terminal-state enum and the exit-code selection function. Route/grant live-reads, admission A1-A3, guards G1-G11, the circuit breaker, and CI wiring follow in C2-C4.

Also extends `collect-org-issues.mjs` with `--repo <name>` (previously `--org`/`--state`/`--output` only), needed for stage 8's planned single-issue pipeline validation against `openIndu/openindu-studio#76`.

## Files touched

| File                                                                                  | Change   | Note                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/engine/states.mjs`                                    | new      | 8 terminal states (mirrors `dev.schema.json`'s enum) + `isClean`/`needsHuman`/`isFailureLike` categorization                                                                                                                                                               |
| `plugins/openindu-control-tower/engine/exit-codes.mjs`                                | new      | 0-5 exit codes (mirrors `dev.schema.json`'s enum) + `exitCodeForStates` (OK iff every issue in the batch is clean, else PARTIAL)                                                                                                                                           |
| `plugins/openindu-control-tower/engine/states.test.mjs`, `exit-codes.test.mjs`        | new      | `node:test` + `node:assert/strict`, matching `collect-org-issues.test.mjs`'s existing convention for pure-function modules (not the hand-rolled subprocess-spawning style in `block-push-main.test.mjs`, which fits a stdin-driven CLI hook, not plain exported functions) |
| `plugins/openindu-control-tower/skills/issue-pipeline/scripts/collect-org-issues.mjs` | modified | `--repo <name>`: when given, fetches that one repository instead of listing the whole org; result object gains a `repo` field                                                                                                                                              |
| `.../collect-org-issues.test.mjs`                                                     | modified | existing "defaults" test updated for the new `repo: null` default field; 4 new cases for `--repo`                                                                                                                                                                          |
| `plugin.json`, `marketplace.json`                                                     | modified | `5.6.0` → `5.7.0`                                                                                                                                                                                                                                                          |

## Why only these two pieces this time

Stage 4's full scope (route/grant live-read, state machine, issue collection, source checks, CI classification, admission A1-A3, guards G1-G11, protected-path/test-integrity detection, log redaction, circuit breaker, revert detection, `./dev ack`, ≥22 test cases, CI wiring) does not fit in one ≤400-line PR within one module boundary (spec/005 section 4's own opening line, and the precedent of stage 2 itself being split into two PRs). Splitting along module boundaries:

- **C1 (this PR)**: states + exit codes + issue collection
- **C2**: route/grant live-read + admission A1-A3
- **C3**: CI status classification + guards G1-G6
- **C4**: guards G7-G11 + circuit breaker + revert detection + `.dev-pause` + `./dev ack` + log redaction + `ci.yml` wiring

Each PR only adds files (the only existing-file edits across the whole split are this PR's two small additions to `collect-org-issues.mjs`/its test, and C4's one new `ci.yml` step), matching stage 4's own stated rollback plan ("new files, revert directly"). `ci.yml` wiring is deliberately deferred to C4 — wiring in only half the engine's tests partway through would just need redoing.

## Mutation-style verification ("disable the check → the case goes red")

Done by hand, not left in the repo (a one-time check, not permanent test infrastructure):

- `states.mjs`: temporarily added `"BLOCKED"` to `CLEAN_STATES`. Result: `states.test.mjs` tests 6 and 7 ("BLOCKED and FAILED are failure-like...", "every terminal state falls into exactly one...") failed (8 pass / 2 fail). Reverted; back to 10/10.
- `exit-codes.mjs`: temporarily hardcoded `allClean = true` (bypassing the real check). Result: all 5 PARTIAL-detection tests in `exit-codes.test.mjs` failed (4 pass / 5 fail). Reverted; back to 9/9.

## Test result

```
collect-org-issues.test.mjs: 29/29
engine/states.test.mjs:       10/10
engine/exit-codes.test.mjs:    9/9
```

`node scripts/check-version-bump.mjs`, `node scripts/sync-route.mjs --check`, `npx prettier@3 --check "**/*.md"`, `claude plugin validate --strict` all pass locally. These three new test files are **not yet wired into `ci.yml`** — deferred to C4 per the split above; run manually until then.

## Impact

| Scope                  | Note                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Behavior change        | None. Nothing in the existing skills or hooks imports `engine/` yet; `--repo` is a new, additive, opt-in flag. |
| Downstream sync needed | No — plugin version bump covers `/plugin update` distribution                                                  |
| Rollback               | Revert the PR; all changes are new files plus one additive CLI flag                                            |

## Next

C2 (route/grant live-read + admission A1-A3), same pattern: state target before writing, local tests green, PR, wait for merge approval.
