---
name: principle
description: The sole authoritative source of openIndu's 11 AI Agent behavior RULEs. Any openIndu repo must load this before starting any task (RULE 1). Also load when涉及 git push, K8s manifests, Gitee PR, production DB writes, delivery pipeline, agent authorization tiers, or completed-artifact modification.
---

Use as `$principle` in Codex. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
