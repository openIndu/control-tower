---
date: 2026-10-30
slug: dev-engine-f8-3-tier-resolution
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#46
---

# engine/tier-resolution.mjs (spec/005 stage 7, PR-F8-3)

## Summary

Third of stage 7's final sub-PRs (F8). spec/005 §2.2's tier baseline describes a proposed change, which
doesn't exist yet at issue intake. This PR resolves tier via one preliminary scoping proposal call whose
structured output self-declares those signals.

## What this PR changes

- `plugins/openindu-control-tower/engine/tier-resolution.mjs`: `resolveTier(issue,
generateScopingProposal)`. L3-action check → `baselineTier` → `applyLlmTierSignal`, using the scoping
  call's own self-assessment as the LLM escalation signal (documented design choice). Scoping proposal
  always discarded; `runStep2` runs fresh with the resolved tier.
- `plugins/openindu-control-tower/engine/carrier-callbacks.mjs` (extends `#45`): added `SCOPING_SCHEMA`
  and `buildRealGenerateScopingProposal`.

## Test result

14 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/tier-resolution.test.mjs plugins/openindu-control-tower/engine/carrier-callbacks.test.mjs
# tests 14, pass 14, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                          |
| --------------- | ------------------------------------------------------------- |
| Behavior change | None — new/extended files, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                                 |
| Plugin version  | Unchanged (`5.19.0`)                                          |
| Rollback        | Revert the PR (purely additive)                               |

## Next

More real-callback wiring for steps 3-6, then the final assembly sub-PR.
