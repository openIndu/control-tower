# Team — openIndu SDLC role pipeline

The governance assets (principles, agent definitions, manifest) live in the public plugin `plugins/openindu-control-tower/` for org-wide zero-copy reuse.

`team/` now holds: this file, [`principle.md`](./principle.md) (pointer), [`STARTUP.md`](./STARTUP.md) (startup guide), and runtime `communications/`.

## Where assets live

| Asset                 | Location                                                   | How to use                     |
| --------------------- | ---------------------------------------------------------- | ------------------------------ |
| 11 principles         | `plugins/openindu-control-tower/skills/principle/SKILL.md` | `/principle`                   |
| 20 agents             | `plugins/openindu-control-tower/agents/*.md`               | `@openindu-control-tower:<id>` |
| Team manifest         | `plugins/openindu-control-tower/reference/manifest.yaml`   | read by manager                |
| Routing               | `plugins/openindu-control-tower/reference/route.json`      | `/route`                       |
| Team startup          | `plugins/openindu-control-tower/skills/launch/SKILL.md`    | `/launch`                      |
| Trunk-protection hook | `plugins/openindu-control-tower/hooks/`                    | auto-effective                 |

## Core principles

| Principle                            | Note                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| **Rule #1: `/principle`**            | Every agent loads `/principle` first; re-load every 20 steps or after compaction |
| **Pure role, zero business binding** | Agents hold only role+skill; business binding in route.json + repo CLAUDE.md     |
| **Single source**                    | Principles and routing each have one source file; no repo self-hosts copies      |
| **Pre-spawn sync + check**           | Every agent: ① `/principle` ② `git pull origin main` ③ `git status`              |
| **Clear escalation**                 | Cross-repo conflict → arbiter; policy exception → manager                        |

## Team architecture

The team is **flat** — teammates can't spawn teammates. Runtime form: one-shot fan-out + file aggregation, NOT a tree:

```
user
 │
 ▼
manager ──spawn──► arbiter        (a normal sub-agent, not a teammate)
 │                    │
 │              writes review_decision.md
 │                    │
 │◄───────reads file──┘
 │
 │  🛑 STOP 1: dispatch plan pending user confirmation
 │
 ├──spawn──► role agent A ─┐
 ├──spawn──► role agent B ─┼─► each writes completion_report.md
 └──spawn──► role agent C ─┘  (parallel, run_in_background)
 │
 │◄───────reads files──────────┘
 │
 │  🛑 STOP 2: change list pending user confirmation
 ▼
user
```

**Don't think of it as a hierarchy.** Sub-agents can't talk to each other or message manager back — all coordination goes through markdown files in `team/communications/threads/`. This constraint means tasks must be sliceable into independent blocks, or parallelism is pointless.

## Agent roster (v5.0.0 — 20 SDLC roles)

| Domain     | Agent(s)                                      |
| ---------- | --------------------------------------------- |
| Governance | manager / arbiter / inspector / control-tower |
| Ideation   | business-analyst / product-manager            |
| Design     | architect / ui-ux-designer                    |
| Build      | frontend / backend / edge / station-control   |
| Quality    | test / reviewer / security                    |
| Data       | data / bi-analyst                             |
| Operations | ops / release                                 |
| Insight    | codebase-analyst                              |

Pipeline: `business-analyst → product-manager → architect → ui-ux-designer → build → ops → bi-analyst`. Definitions in [`../plugins/openindu-control-tower/agents/`](../plugins/openindu-control-tower/agents/). All zero business binding; `/launch` activates the relevant subset per repo.

## Spec design flow

```
trigger (manager dispatch / control-tower self-discovery / inspector proposal)
        │
        ▼
control-tower calls /principle + /route
        │
        ▼
/spec-new first-pass draft
  · role/responsibility consistency
  · contract alignment with上下游 repos
  · RULE 7-11 hard-constraint check
        │
        ▼
submit to arbiter (5 dimensions: principle compliance, cross-repo contract, conflict, minimal change, rollback)
        │
        ├── pass → write to spec/NNN-*.md, finalized
        ├── revise → control-tower revises → re-review (max 3 rounds)
        └── deadlock → escalate to manager
```

## Comms protocol

Inter-agent communication goes through markdown files in `team/communications/threads/{task-id}/`.

| File                       | Direction             | Note                        |
| -------------------------- | --------------------- | --------------------------- |
| `001-review_request.md`    | manager → arbiter     | Pre-dispatch review request |
| `002-review_decision.md`   | arbiter → manager     | approved/rejected           |
| `003-task_assignment.md`   | manager → role agent  | Specific task dispatch      |
| `004-completion_report.md` | role agent → manager  | Completion report           |
| `005-revision_request.md`  | manager → role agent  | Quality-gate return         |
| `00N-escalation.md`        | any → arbiter/manager | Conflict escalation         |
| `00N-proposal.md`          | inspector → manager   | Improvement proposal        |

## Adding an agent

1. Create `plugins/openindu-control-tower/agents/<name>.md` with YAML frontmatter (`name` / `role` / `description`, + `design_dir`/`languages` as applicable)
2. Register in `reference/manifest.yaml` under `agents:`
3. Add a row in this file's roster + the plugin README's Agents table
4. bump `plugin.json` version
5. `claude plugin validate ./plugins/openindu-control-tower --strict`
6. PR (RULE 7)

Structure: role definition → startup prerequisites → skills → techniques → design-doc workflow → capability indicators → behavior constraints → escalation.
