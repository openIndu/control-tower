---
name: issue-pipeline
description: Collect open issues across a GitHub organization, classify which require action, challenge each actionable recommendation with independent reviewers, and dispatch accepted work through the existing SDLC pipeline until its PR has green CI. Use for organization-wide issue triage and execution, not for a single already-selected issue.
---

# Codex entrypoint for issue-pipeline

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$issue-pipeline` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/issue-pipeline/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
