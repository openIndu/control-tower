---
date: 2026-10-29
slug: dev-engine-c4a-pause-codeowners
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#24
---

# engine: .dev-pause primitive and CODEOWNERS parsing (spec/005 stage 4, PR-C4a)

## Summary

First PR of what was originally planned as a single "C4" (the stage-4 split's final PR). Building guards G7-G11 plus everything else C4 covers in one PR would have landed around 468 lines just for the guard layer, over spec/005 section 4's explicit `<=400 lines AND one module boundary` -- the same reasoning that already split C3 into `#22`/`#23`. So C4 itself splits further: this PR is the two small reusable primitives the G7-G11 guards need; the guards themselves are the next PR (C4b); circuit breaker/revert detection/`.dev-pause` write path/`./dev ack`/log redaction/`ci.yml` wiring come after that (C4c, possibly further split once sized).

Adds `engine/dev-pause.mjs` (`isPaused`/`writePause` -- deliberately no exported clear/remove function, since spec/005's circuit breaker says only a human clears a pause and the runner never auto-clears; not exporting a clear API means the runner's own code has no path that could do it by accident) and `engine/codeowners.mjs` (CODEOWNERS parsing + last-match-wins owner lookup, reusing the glob matcher from `#21`'s `path-rules.mjs`).

## Test result

```
engine/dev-pause.test.mjs:  4/4
engine/codeowners.test.mjs: 7/7
```

Plus the rest of the engine's 121 unchanged tests still passing. `check-version-bump.mjs` (`5.10.0 → 5.11.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally. Neither module is consumed by anything yet (that's C4b) and nothing is wired into `ci.yml` yet (that's C4c).

## Note on CODEOWNERS pattern normalization

`codeowners.mjs` normalizes three conventions: a leading `/` root-anchors, a trailing `/` is a directory, and a pattern with no `/` anywhere (e.g. `*.mjs`) matches at any depth rather than only the repo root -- the last of these matters because it is the single most common CODEOWNERS pattern shape (`*.go @team`), and getting it wrong would have silently under-protected every nested file. A pattern with a `/` in the middle but no leading `/` is treated as root-anchored, a deliberate simplification over full gitignore-directory-relative semantics (CODEOWNERS only ever lives at this org's repo root, so the two are equivalent in practice). Caught this by a test that should have been correct from the start (`*.mjs` failing to match `scripts/other.mjs`) rather than quietly weakening the test to fit a bug.

## Impact

| Scope           | Note                           |
| --------------- | ------------------------------ |
| Behavior change | None                           |
| Files touched   | Two new files, both unconsumed |
| Rollback        | Revert the PR                  |

## Next

C4b: guards G7, G8, G9, G10, G11, composing this PR's two primitives plus `#21`'s route-reader and `#22`'s ci-status.
