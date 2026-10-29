---
date: 2026-10-29
slug: dev-engine-c4c-circuit-breaker-ack-redaction-ci
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#26
---

# engine: circuit breaker, ./dev ack, log redaction, ci.yml wiring (spec/005 stage 4, PR-C4c)

## Summary

Final PR of stage 4's split. Stage 4 ended up as 7 PRs instead of the 4 originally planned (`#20`, `#21`, `#22`+`#23`, `#24`+`#25`, and this one) — each split was the same reasoning applied again: spec/005 section 4's own `≤400 lines AND one module boundary` limit, stricter than RULE 4's default OR, left no real choice once a module's actual size was known. Noted again here for a complete trail, not because the reasoning changed.

Adds:

- `engine/circuit-breaker.mjs` — `shouldTripCircuitBreaker` (any of: post-merge default-branch CI red, non-runner merge detected, 2 consecutive BLOCKED issues, repeated tool errors) and `detectRevertOfRecordedMerge` (scans default-branch commit messages for git's own `This reverts commit <sha>` format against this runner's recorded merges).
- `engine/ack.mjs` — `evaluateAck` (`./dev ack <run-id>`: rejects non-interactive, rejects a `gh` login other than the grant's `approved_by`) and `needsAckDowngrade` (no `ack_at` within 72h of a merge → next run auto-downgrades to PR-only).
- `engine/log-redaction.mjs` — `redactSecrets`, scrubbing credential-shaped substrings (GitHub/Anthropic/AWS token prefixes, `Authorization:` headers, `*TOKEN*`/`*SECRET*`/`*PASSWORD*`/`*API_KEY*` assignments) before text reaches a log or report. Defense in depth on top of section 2.6's environment-level controls, not a replacement for them — a regex list of "what a secret looks like" is inherently incomplete, stated in the code comment rather than implied otherwise.
- `.github/workflows/ci.yml` — a new step running every `engine/*.test.mjs` plus `collect-org-issues.test.mjs` (the C1 PR's own test file, which has been passing locally since `#20` but was never wired in — a pre-existing gap in this same stage's own deliverable, closed here since this is exactly the step that closes it).

## Known gaps, stated rather than hidden

- `detectRevertOfRecordedMerge` only recognizes git's own textual revert-commit-message format. Spec/005 also names "an equivalent inverse patch" as a trigger; detecting that generically needs fetching and diffing actual patches, not comparing commit-message strings, and is not implemented here.
- `redactSecrets`'s pattern list is a documented starting baseline, not a closed set.

## Mutation-style verification

- `shouldTripCircuitBreaker`: short-circuited the non-runner-merge condition to `if (false)`. Result: exactly the one test for that condition failed (9 pass / 1 fail). Reverted.
- `evaluateAck`: short-circuited the gh-login-mismatch check to `if (false)`. Result: exactly the one test for a mismatched login failed (6 pass / 1 fail). Reverted.
- `ci.yml` wiring: deliberately broke one assertion in `ack.test.mjs`, ran the exact loop the new CI step runs, confirmed the overall exit code became 1. Reverted.

All back to fully green after restoring.

## Closing acceptance criterion #19's loop

Added one more test in `circuit-breaker.test.mjs` beyond what was planned: an end-to-end case chaining `detectRevertOfRecordedMerge`'s detection into an actual `writePause` call and confirming `isPaused` flips true — the detection half and the `.dev-pause`-write half each already had unit coverage from this PR and `#24`, but acceptance criterion #19 names the composed scenario specifically ("出现回滚 → 写 .dev-pause"), and nothing had exercised the two wired together until now.

## Test result

```
engine/circuit-breaker.test.mjs: 11/11
engine/ack.test.mjs:              7/7
engine/log-redaction.test.mjs:    8/8
```

Plus the engine's other 142 unchanged tests, all 15 engine-related test files now run by the new `ci.yml` step, locally confirmed equivalent (ran the exact loop, exit 0). `check-version-bump.mjs` (`5.12.0 → 5.13.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally.

## Stage 4 tally against spec/005 section 6's relevant acceptance criteria

| #   | Criterion                                                                                                                       | Status                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | ≥22 guard truth-table cases (≥2 each: pass, block), revert-guard-turns-case-red verified                                        | 45 guard test cases across `guards-core.test.mjs` + `guards-g7-g11.test.mjs` (G1-G11), every guard mutation-verified by hand across `#20`-`#25` and this PR |
| 18  | `ci.yml` wired, all green                                                                                                       | Done by this PR                                                                                                                                             |
| 19  | 72h ack rule, non-interactive/wrong-login `./dev ack` rejection, revert detection writes `.dev-pause`, runner never auto-clears | All four covered; see above for the composed case added this PR                                                                                             |

## Impact

| Scope           | Note                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | None to any existing repo — nothing calls these modules yet (that is stage 5+: the reasoning layer and the merge orchestration) |
| `ci.yml`        | Additive step; does not change any existing step                                                                                |
| Rollback        | Revert the PR                                                                                                                   |

## Next

Stage 4 is complete. Stage 5: isolated runtime + reasoning layer + its own eval suite (PR-D) — the eval run itself is expected to be comparably expensive to the SA-1 eval from stage 1, which will be flagged before running rather than folded silently into this batch authorization.
