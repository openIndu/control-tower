---
name: principle
description: The sole authoritative source of openIndu's 11 AI Agent behavior RULEs. Any openIndu repo must load this before starting any task (RULE 1). Also load when涉及 git push, K8s manifests, Gitee PR, production DB writes, delivery pipeline, agent authorization tiers, or completed-artifact modification.
---

# Codex entrypoint for principle

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/principle/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
