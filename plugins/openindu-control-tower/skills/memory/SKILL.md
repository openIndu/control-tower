---
name: memory
description: "Read/write the team's reusable lessons ledger. Each role's踩坑/技巧/repeated-wins沉淀 to team/memory/<role>/ so agents don't re-derive them. Every agent reads its role memory at startup and appends a lesson after a non-trivial success or failure. Use to seed a role's memory before a task or to record a hard-won insight."
argument-hint: '[--read <role> | --add <role> "<lesson>"]'
disable-model-invocation: true
---

# /memory — Team lessons ledger

Agents are otherwise stateless per task. This skill gives them a **persistent, role-scoped memory** of踩坑、技巧、repeated wins — so the next run reuses them instead of re-deriving. Inspired by ECC's instincts/continuous-learning.

**Call `/principle` first** (RULE 1).

---

## Where memory lives

```
team/communications/memory/
├── README.md                       # how to use + index
├── <role>/
│   ├── pitfalls.md                  # hard-won "don't do X because Y"
│   ├── techniques.md                # reusable patterns that worked
│   └── context.md                  # role-specific facts (e.g. which test framework is canonical)
```

Per-role. Not per-repo (the brain is role knowledge; repo-specific facts are in that repo's CLAUDE.md + design/).

## 1. Read (every agent startup)

Every agent, as part of "startup prerequisites", reads its own role memory:

```
team/communications/memory/<my-role>/pitfalls.md     (if exists)
team/communications/memory/<my-role>/techniques.md   (if exists)
```

Don't read other roles' memory unless escalating/handing off — stay scoped.

## 2. Write (after a non-trivial task)

After completing (or failing) a non-trivial task, append a lesson:

```bash
# pitfall (something that bit)
team/communications/memory/<role>/pitfalls.md
  - [YYYY-MM-DD] <repo>:<file:line> — <what bit> — <fix> — (task-id)

# technique (something that worked well, reusable)
team/communications/memory/<role>/techniques.md
  - [YYYY-MM-DD] <pattern> — <why it worked> — (task-id)
```

Rules:

- **Cite `repo:file:line` or the pattern** — no unsourced claims (RULE 5.1 ethos).
- **One lesson per line**, append-only. Don't rewrite history (RULE 6).
- **Don't log business knowledge** — log _technique_ and _pitfall_, not which service does what. If it's business knowledge, it belongs in route.json + repo CLAUDE.md, not here.
- **No credentials** ever (RULE 5.4).

## 3. Seed before a task

Before a tricky task, a role may seed its memory with a known technique:

```
/memory --add backend "When a destructive Alembic migration is needed, split it: add nullable column → backfill → make required, across three PRs."
```

## 4. Quality bar

| Indicator               | Bar                                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| Cited                   | every pitfall names a location or pattern                           |
| Reusable                | a technique is generic enough to apply next time, not task-specific |
| Append-only             | never rewrite/delete (RULE 6); wrong lessons get a correction line  |
| Zero business knowledge | role technique only; no service/repo binding                        |

## 5. Boundary

`/memory` is the _persisted lessons_ layer. It complements `team/communications/threads/` (per-task coordination) — threads are task-scoped and ephemeral; memory is role-scoped and cumulative.
