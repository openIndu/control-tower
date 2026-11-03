---
name: design-md
description: "Adopt a DESIGN.md design-system document for a project — pick from the awesome-design-md collection or generate one for the user's brand. ui-ux-designer then writes design/uiux/DESIGN.md and frontend implements against it, producing visually consistent UI. Use when a feature needs UI work and there's no design system yet, or to match a known brand's look."
---

# Codex entrypoint for design-md

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$design-md` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/design-md/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
