---
name: memory
description: "Read/write the team's reusable lessons ledger. Each role's踩坑/技巧/repeated-wins沉淀 to team/memory/<role>/ so agents don't re-derive them. Every agent reads its role memory at startup and appends a lesson after a non-trivial success or failure. Use to seed a role's memory before a task or to record a hard-won insight."
---

# Codex entrypoint for memory

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$memory` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/memory/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
