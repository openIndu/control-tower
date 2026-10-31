---
date: 2026-10-31
slug: dev-skill-definition
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#70
---

# F8-24: add the /dev skill definition

## Summary

spec/005 section 2.1 names `/dev <repo>` as one of the two equivalent entry points into the same
runner (`skills/dev/scripts/dev.mjs`), the other being the workspace's own `./dev`/`dev.cmd`
launchers (built separately, directly in the workspace root, not tracked in this repo per the
spec's own ownership table). `skills/dev/` had the runner script and its tests but no `SKILL.md`,
so `/dev` did not exist as an invocable command until this PR.

## What this PR adds

`plugins/openindu-control-tower/skills/dev/SKILL.md`, modeled on `skills/issue-pipeline/SKILL.md`'s
frontmatter shape (`disable-model-invocation: true`) but much shorter in body: the model does none
of the pipeline's real work here (that is all deterministic script logic already merged across
stage-7's prior PRs), so the skill is mostly an argument reference, a "relay the result, don't
re-derive a verdict" section, and a boundary paragraph.

## Test result

No code changed. `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs` all pass. 514/514 engine+dev tests still pass on `main`.

## Impact

| Scope           | Note                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| Behavior change | `/dev` is now a real, invocable skill command                                      |
| Blast radius    | `openIndu/control-tower` only; still unreachable — no repo has `dev.enabled: true` |
| Plugin version  | `5.27.0` -> `5.28.0`                                                               |
| Rollback        | Revert the PR                                                                      |

## Next

Workspace launchers (`dev`/`dev.cmd`, already built and smoke-tested directly in the workspace
root, not tracked here); the closing acceptance sweep against all 20 rows of spec/005 section 6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
