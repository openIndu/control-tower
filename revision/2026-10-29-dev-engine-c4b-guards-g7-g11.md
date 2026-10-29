---
date: 2026-10-29
slug: dev-engine-c4b-guards-g7-g11
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#TBD
---

# engine: guards G7-G11 (spec/005 stage 4, PR-C4b)

## Summary

Second PR of the former single "C4" (first: `#24`, the `.dev-pause`/CODEOWNERS primitives). Adds `engine/guards-g7-g11.mjs`: `guardG7` (ready, conflict-free, mergeable), `guardG8` (default-branch HEAD CI green + PR includes that HEAD, reusing `#22`'s `isCheckGreen`), `guardG9` (every CODEOWNERS owner required by the changed paths is an authorized approver, reusing `#24`'s `codeowners.mjs`), `guardG10` (issue-author/commenter write permission, body-hash stability, thin-issue crowd-derived-acceptance-criteria exclusion — plus an exported `computeBodyHash` so the snapshot step and this re-check always hash the same way), `guardG11` (live grant validity, fail-closed on any read failure, reusing `#21`'s `resolveRepoAuthorization` and `#24`'s `isPaused`).

## Design note: what each guard takes as given vs. computes

Same pattern as `guardG1`/`guardG8` in `#22`: facts that need a real git/gh call against the current moment (ancestry checks, whether a review's permission lookup succeeded) are supplied as caller-provided booleans, not computed inside these pure functions. G7's "the guards that gated promotion to ready all passed" half of its spec text is a process invariant the orchestration enforces by construction (it only promotes after checking them) — which is exactly why spec/005 has the orchestration re-check G1, G2, G7, G8, G10, G11 again right after promotion, rather than asking G7 itself to reconstruct history it was never given.

## Mutation-style verification

- `guardG11`'s fail-closed route-read check: replaced the `if (!routeReadSucceeded)` condition with `if (false)`. Result: exactly the one test covering a failed route read failed (21 pass / 1 fail). Reverted.
- `guardG9`'s unauthorized-owner filter: replaced with a filter that always returns nothing. Result: exactly the one test covering an unauthorized CODEOWNERS owner failed (21 pass / 1 fail). Reverted.

Both back to 22/22 after restoring.

## Test result

```
engine/guards-g7-g11.test.mjs: 22/22
```

Plus the rest of the engine's 128 unchanged tests (across states, exit-codes, collect-org-issues, route-reader, admission, ci-status, guards-core, path-rules, test-integrity, dev-pause, codeowners) still passing. `check-version-bump.mjs` (`5.11.0 → 5.12.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally. Still not wired into `ci.yml` — that's C4c.

## Impact

| Scope           | Note                                        |
| --------------- | ------------------------------------------- |
| Behavior change | None                                        |
| Rollback        | Revert the PR; new file, nothing imports it |

## Next

C4c: circuit breaker (trip conditions), revert detection, `./dev ack`, log redaction, `ci.yml` wiring. With this PR, all 11 guards (G1-G11) and both admission-side checks (A1-A3) now exist — C4c is operational/CLI plumbing around them, not more guard logic, so it should size closer to C3/C4a than to C3b/C4b.
