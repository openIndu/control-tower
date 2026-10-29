---
date: 2026-10-29
slug: dev-engine-c2-route-admission
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#TBD
---

# engine: route/grant live-read and admission A1-A3 (spec/005 stage 4, PR-C2/4)

## Summary

Second of four PRs implementing the deterministic `/dev` engine (first: `#20`, states + exit codes + `--repo` issue collection). Adds `engine/route-reader.mjs` (structural/device-type exclusion, grant lookup, live route.json fetch) and `engine/admission.mjs` (A1-A3).

## Files touched

| File                                                 | Change   | Note                                                                                                                                                           |
| ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/route-reader.mjs`                            | new      | `parseRoute`, `isStructurallyExcluded`, `isDeviceTypeRepo`, `resolveRepoAuthorization`, `fetchRouteText` (live `gh api .../contents/...` read, base64-decoded) |
| `engine/admission.mjs`                               | new      | `admissionA1`/`A2`/`A3`, `evaluateAdmission`                                                                                                                   |
| `engine/route-reader.test.mjs`, `admission.test.mjs` | new      | `node:test` + `node:assert/strict`, same convention as C1                                                                                                      |
| `plugin.json`, `marketplace.json`                    | modified | `5.7.0` → `5.8.0`                                                                                                                                              |

## Scope notes

`resolveRepoAuthorization` implements section 2.3-2 points 1-2 (structural exclusion, device-type + `dev.safety_paths` gating, grant lookup + expiry) — **not** G11's full set (live SA-1-marker check, `principle_ref` ancestry, `.dev-pause`), which needs a git/gh call against the current moment and belongs with the other merge guards in C4. A1-A3 are independent of grants entirely — they gate whether the runner may act on a repo at all, before any guard is evaluated.

## Mutation-style verification

- `route-reader.mjs`: temporarily short-circuited the device-type/`safety_paths` check (`if (false && isDeviceTypeRepo(...))`) — the one guard that keeps `openindu-studio` out of any grant until `dev.safety_paths` is registered. Result: exactly the test covering that case failed (25 pass / 1 fail: `resolveRepoAuthorization fails for a device-type repo with no dev.safety_paths...`). Reverted; back to 26/26.
- `admission.mjs`: temporarily hardcoded A2's `missing` kinds list to `[]`. Result: both missing-kind tests failed (13 pass / 2 fail). Reverted; back to 15/15.

## Test result

```
engine/route-reader.test.mjs: 26/26
engine/admission.test.mjs:    15/15
```

(Plus the unchanged `states.test.mjs` 10/10, `exit-codes.test.mjs` 9/9, `collect-org-issues.test.mjs` 29/29 from C1 — still passing, nothing in this PR touches them.)

`node scripts/check-version-bump.mjs`, `node scripts/sync-route.mjs --check`, `npx prettier@3 --check "**/*.md"`, `claude plugin validate --strict` all pass locally. Not yet wired into `ci.yml` — deferred to C4.

## Impact

| Scope                  | Note                                 |
| ---------------------- | ------------------------------------ |
| Behavior change        | None. Nothing yet imports `engine/`. |
| Downstream sync needed | No                                   |
| Rollback               | Revert the PR; new files only        |

## Next

C3 (CI status classification + guards G1-G6), same pattern.
