---
name: design
description: Orchestrate the 0-to-1 SDLC pipeline across the role agents. Hands off along business-analyst → product-manager → architect → ui-ux-designer → build (backend/frontend/edge/station-control) → ops → bi-analyst, with each phase writing its design/&lt;domain&gt;/ artifact and the next phase reading it. Use when a feature needs the full design pipeline (not a one-off fix).
---

# Codex entrypoint for design

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$design` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/design/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
