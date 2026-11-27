---
name: issue-verify-loop
description: Lightweight loop for one repository's open Issues — collect (PR #20 engine) → develop per issue (red-green, local gates) → dispatch /session-verify per fix → green PRs with re-inspection receipts. No leases/checkpoints (heavy machinery = /dev_issue).
---

Use as `$issue-verify-loop` in Codex. Only use on explicit `$issue-verify-loop` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/issue-verify-loop/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
