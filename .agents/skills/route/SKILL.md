---
name: route
description: Query openIndu repo routing — repo URL, type, host (GitHub/Gitee), image, domain, aggregate ownership, K8s namespace. Use to determine "which repo does this change belong to", "what's this service's image/domain", or "GitHub PR or Gitee PR".
---

# Codex entrypoint for route

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/route/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
