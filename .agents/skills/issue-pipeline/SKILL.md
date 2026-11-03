---
name: issue-pipeline
description: Collect open issues across the authorized GitHub organization scope, classify which require action, challenge recommendations with independent reviewers, and dispatch accepted work through role agents or /autopilot to a green PR. Use for organization issue triage, not a single already-selected issue.
---

Use as `$issue-pipeline` in Codex. Only use on explicit `$issue-pipeline` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/issue-pipeline/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
