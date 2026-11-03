---
name: issue-pipeline
description: Collect open issues across a GitHub organization, classify which require action, challenge each actionable recommendation with independent reviewers, and dispatch accepted work through the existing SDLC pipeline until its PR has green CI. Use for organization-wide issue triage and execution, not for a single already-selected issue.
---

Use as `$issue-pipeline` in Codex. Only use on explicit `$issue-pipeline` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/issue-pipeline/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
