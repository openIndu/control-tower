---
date: 2026-08-29
slug: detach-studio-route
type: route
related_spec: —
author: control-tower
pr: pending
---

# Detach Studio from the Website aggregate route

## Summary

Remove `openIndu-studio` from the Website aggregate relationship after the
project was moved to independent maintenance. This keeps routing and delivery
guidance aligned with the Website aggregate's three remaining submodules.

## Files involved

| File                                                            | Change   | Note                                                                              |
| --------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/reference/route.json`           | modified | Removes the aggregate relationship and records Studio's independent library flow. |
| `route.json`                                                    | modified | Regenerated from the authoritative route source.                                  |
| `plugins/openindu-control-tower/skills/route/SKILL.md`          | modified | Updates routing guidance and removes stale Studio comparisons.                    |
| `plugins/openindu-control-tower/skills/delivery-check/SKILL.md` | modified | Changes Studio delivery from a two-repository flow to its own reviewed change.    |
| `revision/2026-08-29-detach-studio-route.md`                    | added    | Records this routing change and its verification.                                 |

## Trigger

User-requested open-source preparation in `openIndu/openIndu-website#194`,
which removes the Studio gitlink and keeps the Studio repository independent.

## Impact assessment

| Scope           | Note                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| Affected agents | Route and delivery-check consumers stop requesting a Website pointer bump for Studio. |
| Downstream sync | Plugin consumers should update after this control-tower PR is reviewed and merged.    |
| Rollback        | Revert this commit and regenerate `route.json`.                                       |

## Verification record

- [x] `npx prettier --check "**/*.md"` passed
- [ ] arbiter review passed (if applicable)
- [ ] downstream repos synced (if applicable)
