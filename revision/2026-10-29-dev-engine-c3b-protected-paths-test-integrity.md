---
date: 2026-10-29
slug: dev-engine-c3b-protected-paths-test-integrity
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#23
---

# engine: protected paths and test-integrity detection, guard G4 (spec/005 stage 4, PR-C3b)

## Summary

The rest of G4, split out of C3 (`#22`) because it needed its own glob matcher and diff-text heuristics. Adds `engine/path-rules.mjs` (dependency-free glob matcher, `DEFAULT_PROTECTED_PATTERNS`, scope-containment and protected-path-hit checks) and `engine/test-integrity.mjs` (deleted-test / added-skip-xfail-only / lowered-coverage-threshold detection). Wires both into a new `guardG4` in `guards-core.mjs`.

## Known gap, stated rather than hidden

`DEFAULT_PROTECTED_PATTERNS` only includes categories expressible as a literal path/filename pattern (workflows, CODEOWNERS, env/secret/cert files, `.claude/**`, CLAUDE.md, AGENTS.md, lockfiles, `.gitmodules`). Spec/005's table also lists categories that are content-dependent, not just path-dependent (a YAML file that happens to declare a K8s resource; auth/permission _logic_ versus files merely named like it) — those need inspecting file content, which this PR does not do. Calling this "covered" would be worse than leaving the gap visible, so it's flagged here and in the code comment rather than silently assumed solved.

Similarly, `test-integrity.mjs`'s skip/xfail/only detection covers the common idioms for `node:test`/vitest/jest and pytest — not an exhaustive parse of every test framework's skip syntax.

## Mutation-style verification

- `isProtectedPath`: dropped `DEFAULT_PROTECTED_PATTERNS` from the match list (kept only per-repo extras). Result: exactly the 11 tests that exercise the default list failed in `path-rules.test.mjs` (8 pass / 11 fail), plus the one `guardG4` test for a protected-path hit (22 pass / 1 fail). Reverted; both back to fully green.
- `removedTestFiles`: replaced the body with a filter that always returns false. Result: exactly the 2 tests covering deleted-test detection failed in `test-integrity.test.mjs` (9 pass / 2 fail), plus the one `guardG4` test for a deleted test file (22 pass / 1 fail). Reverted; both back to fully green.

## Test result

```
engine/path-rules.test.mjs:     19/19
engine/test-integrity.test.mjs: 11/11
engine/guards-core.test.mjs:    23/23  (18 from #22 + 5 new G4 cases)
```

Plus the rest of the engine's unchanged suites (87 tests across states/exit-codes/collect-org-issues/route-reader/admission/ci-status) still passing. `check-version-bump.mjs` (`5.9.0 → 5.10.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally. Not yet wired into `ci.yml` — still deferred to C4, the split's final PR.

## Impact

| Scope           | Note                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Behavior change | None                                                                                                                 |
| Files touched   | `path-rules.mjs`, `test-integrity.mjs` new; `guards-core.mjs` gains `guardG4` (additive, no existing export changed) |
| Rollback        | Revert the PR                                                                                                        |

## Next

C4: guards G7-G11 + circuit breaker + revert detection + `.dev-pause` + `./dev ack` + log redaction + `ci.yml` wiring (the last PR of this split, and the one that finally runs the engine's tests in CI).
