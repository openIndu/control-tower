---
name: design
description: Orchestrate the 0-to-1 SDLC pipeline across the role agents. Hands off along business-analyst → product-manager → architect → ui-ux-designer → build (backend/frontend/edge/station-control) → ops → bi-analyst, with each phase writing its design/&lt;domain&gt;/ artifact and the next phase reading it. Use when a feature needs the full design pipeline (not a one-off fix).
---

Use as `$design` in Codex. Only use on explicit `$design` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/design/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
