---
name: research
description: Research competing products, released features, public roadmaps and evidence-backed differentiation, then recommend concrete actions for one openIndu task.
---

# Codex entrypoint for research

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$research` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/research/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
