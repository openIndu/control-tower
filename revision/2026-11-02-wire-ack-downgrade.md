---
date: 2026-11-02
slug: wire-ack-downgrade
type: fix
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#72
---

# F8-26: wire the 72-hour ack downgrade into the real run path

## Summary

Found during spec/005 section 6's closing 20-criterion acceptance sweep: criterion #19's first
clause (a merge sitting more than 72 hours without a human `./dev ack` must force the next run
to stop after CI goes green, PR-only) was fully implemented and unit-tested
(`engine/ack.mjs`'s `needsAckDowngrade`) during an earlier stage, but never actually called from
the real run path. This is the same "built but never wired" shape as #71 (isolation positive
controls), a different file/mechanism, and not a stage-7 regression -- leftover integration
scope from an earlier stage that the prior "merged" status did not actually cover.

## What this PR fixes

`dev.mjs`'s `runRepo` now computes `hasOverdueUnackedMerge(repoDocsDir)` once per run (default
implementation `defaultHasOverdueUnackedMerge` scans every `dev-runs/<runId>/state.json` under
the repo's own docs dir and asks `needsAckDowngrade` about each issue's `{mergedAt, ackAt}`) and
ORs it into `stopAfterCiGreen`, alongside the pre-existing `options.noMerge` and grant-
authorization checks.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 522, pass 522, fail 0
```

4 new tests. Mutation-checked the `stopAfterCiGreen` OR-term and the scanner's positive-match
branch -- each broke exactly its predicted test; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| Behavior change | A real run now goes PR-only if a prior merge sat unacked past 72 hours             |
| Blast radius    | `openIndu/control-tower` only; still unreachable — no repo has `dev.enabled: true` |
| Plugin version  | `5.29.0` -> `5.30.0`                                                               |
| Rollback        | Revert the PR                                                                      |

## Next

With this and #71 merged, both gaps found during spec/005 section 6's closing sweep are closed.
All 20 criteria in section 6 are now either wired into the real run path or out of scope for this
sweep (criterion #11 is spec/006's own eval suite; criterion #20 is the process checklist for the
future stage-9 grant PR itself). Stage 8/9 (real execution against a pilot repo, and the
maintainer-only L3 grant) remain untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
