---
name: adopt
description: Onboard the current openIndu repo to the public workflow plugin and converge duplicate governance assets (principle copies, duplicate governance agents, ghost /launch commands). Use when a sub-repo first introduces the public principles or has a self-hosted principle.md / PRINCIPLE.md copy.
---

# Codex entrypoint for adopt

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$adopt` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/adopt/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
