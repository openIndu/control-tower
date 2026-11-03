---
date: 2026-11-03
slug: retire-dev-authorization
type: principle | route
related_spec: 010-workflow-entrypoints-and-retirement
author: control-tower
pr: openIndu/control-tower#103
---

# Retire standing dev merge authorization

## Summary

Complete the authorized #84 retirement. Revert the four SA-1 additions from the
authoritative principle, remove `dev_grants` and the openindu-studio dev grant
from the authoritative route, and regenerate the root route mirror. Mark specs
005 and 006 superseded while preserving their historical content and appending
dated supersession notices. Spec 010 records the approved replacement.

## Files

| File                                                       | Change              | Reason                                                 |
| ---------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| `plugins/openindu-control-tower/skills/principle/SKILL.md` | Update              | Revoke SA-1 and restore human review for L2+ PR merges |
| `plugins/openindu-control-tower/reference/route.json`      | Update              | Remove standing grants and old runner enablement       |
| `route.json`                                               | Generated update    | Keep the route mirror identical to its source          |
| `spec/005-org-dev-workflow.md`                             | Supersession marker | Preserve history; retire legacy `/dev` contract        |
| `spec/006-standing-merge-authorization.md`                 | Supersession marker | Preserve history; record SA-1 revocation               |
| `spec/README.md`                                           | Update              | Show current superseded status                         |
| `revision/2026-11-03-retire-dev-authorization.md`          | Add                 | Record the approved governance change and rollback     |

## Trigger and approval

The maintainer requested completion of PR #84 and retirement of its standing
authorization. Spec 010 was finalized after arbiter review and explicitly
authorizes the four principle reversions and grant removal. Historical specs are
not rewritten beyond status/date metadata and an appended supersession notice.

## Impact and rollback

Only `openIndu/control-tower` governance and routing files change. The change
removes autonomous standing merge authority and disables the old dev runner's
route grant. Revert this PR to restore the previous state if necessary; any later
grant requires a new approved governance spec and review.

## Verification

- `node scripts/sync-route.mjs --check`.
- Parse both route JSON files and confirm no `dev_grants` or
  `openindu-studio.dev.enabled` entry remains.
- Confirm the principle diff contains only the four SA-1 text reversions.
- Confirm specs 005 and 006 remain intact and are indexed as superseded.
- PR CI and human review are required before merge.
