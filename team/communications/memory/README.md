# Memory — role-scoped lessons ledger

Persisted踩坑/技巧/repeated-wins for each role, so agents don't re-derive them. Managed by the `/memory` skill.

## Structure

```
memory/
├── README.md            # this file
├── manager/
├── business-analyst/
├── product-manager/
├── architect/
├── ui-ux-designer/
├── frontend/
├── backend/
├── edge/
├── station-control/
├── test/
├── reviewer/
├── security/
├── data/
├── bi-analyst/
├── ops/
├── release/
└── codebase-analyst/
```

Each role dir holds `pitfalls.md`, `techniques.md`, `context.md` (created on demand by the role).

## Rules (from /memory skill)

- Every agent reads its own role memory at startup.
- After a non-trivial task, append a lesson (pitfall or technique) with a `repo:file:line` or pattern citation.
- **Append-only** (RULE 6); correct a wrong lesson by adding a correction line.
- **No business knowledge** — role technique only; service/repo binding goes to route.json + repo CLAUDE.md.
- **No credentials** (RULE 5.4).

## Boundary

This is the _persisted lessons_ layer. `team/communications/threads/` is per-task coordination (ephemeral); `memory/` is role-scoped and cumulative.
