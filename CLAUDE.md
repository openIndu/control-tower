# openIndu Control Tower

This repo is the **control center (Control Tower)** of the openIndu community's AI end-to-end development workflow — an independent "brain" separate from business sub-repos. It maintains cross-repo routing, Agent behavior principles, and Agent prompts, and distributes these assets to every repo via a **Claude Code plugin**.

---

## Project positioning

| Position                           | Description                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Brain**                          | Independent control repo; maintains `route.json` (repo locations/types/images/domains)                   |
| **Distribution hub**               | The public plugin `openindu-control-tower@openindu` ships principles, agents, skills, hooks to all repos |
| **Authoritative principle source** | `/principle` is every agent's Rule #1; the 11 RULEs are maintained by the openIndu community             |
| **Spec designer**                  | Feature designs in `spec/` get a first pass by control-tower, finalized after arbiter review             |

> Note: this repo is `control-tower` type, **not** `aggregate`. The aggregate repo handles submodule aggregation + image builds and is governed by this repo. The two are often confused.

---

## Repo types (abstraction)

The control layer **does not enumerate concrete repos**. This repo only defines repo **types and contracts**; concrete instances are data, queried at runtime via `/route`.

| Type               | Contract                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| `control-tower`    | The sole source of principles, agent definitions, and the public plugin          |
| `aggregate`        | Submodule aggregation, drives image builds, relay in the delivery pipeline       |
| `backend`          | Server-side app, produces images, has a `.env.example` contract                  |
| `frontend`         | Static site, produces images, has a domain and nginx config                      |
| `gitops`           | The single home for K8s manifests; only this type may contain prod YAML (RULE 8) |
| Product-line types | `platform` / `tooling` / `application` / `edge`; release styles defined per type |

**Why no repo list**: the control layer enumerating downstream instances is a dependency inversion — adding a repo would force editing the brain's docs, so the brain ends up depending on the leaves. Types are abstractions (stable); instances are data (mutable).

> Adding a repo only requires a new entry in `plugins/openindu-control-tower/reference/route.json` + a `revision/` record — **this file stays untouched**. A new repo _type_ is the only case that touches this file, and that goes through `/spec-new`.

**Boundary note**: the `gitops`-type repo lives on Gitee; PR titles/bodies in English (RULE 9). All K8s manifest changes go through it (RULE 8).

---

## Distribution: the public plugin

```mermaid
graph TD
    brain["control-tower (brain)<br/>marketplace.json + plugins/openindu-control-tower<br/>11 principles + 20 agents + 16 skills + hook"]
    settings["each repo's .claude/settings.json<br/>6-line reference → effective on clone → /plugin update pulls updates"]
    brain --> settings
    settings --> aggregate
    settings --> backend
    settings --> adminportal["openindu-admin / openindu-portal"]
    settings --> studio
    settings --> platform
    settings --> infra["infra-deploy"]
    settings --> more["…"]
```

A sub-repo onboards by writing in `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "openindu": {
      "source": {
        "source": "github",
        "repo": "openIndu/control-tower"
      }
    }
  },
  "enabledPlugins": { "openindu-control-tower@openindu": true }
}
```

`/adopt` does this and lists duplicate governance assets for confirmation.

| Responsibility             | Where                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Maintain routing           | `plugins/openindu-control-tower/reference/route.json` (sole source); root is sync product |
| Maintain principles        | `plugins/openindu-control-tower/skills/principle/SKILL.md` (sole source of 11 RULEs)      |
| Maintain agent definitions | `plugins/openindu-control-tower/agents/*.md` (20 SDLC role agents, zero business binding) |
| Spec design + review       | `spec/` first-pass by control-tower → arbiter review                                      |
| Distribute assets          | plugin version release; downstream `/plugin update`                                       |
| Delivery pipeline          | RULE 11: sub-repo PR → merge → aggregate submodule → /build → gitops PR → apply           |

---

## Agent behavior hard constraints (11 RULEs速查)

| #   | Constraint                                                                 | RULE    |
| --- | -------------------------------------------------------------------------- | ------- |
| 1   | First step: call `/principle`                                              | RULE 1  |
| 2   | Local lint/format check before commit                                      | RULE 2  |
| 3   | Scripts > LLM > agent; escalate only as needed                             | RULE 3  |
| 4   | L2/L3 actions need human approval                                          | RULE 4  |
| 5   | Cross-repo changes via spec + arbiter                                      | RULE 5  |
| 6   | Completed artifacts不可变                                                  | RULE 6  |
| 7   | **No push to main/master** (plugin hook blocks)                            | RULE 7  |
| 8   | **K8s manifests only in infra-deploy**                                     | RULE 8  |
| 9   | **Gitee PR titles/bodies in English**                                      | RULE 9  |
| 10  | **Production SQL: multi-column WHERE + BEFORE/AFTER + conditional commit** | RULE 10 |
| 11  | **After fix: full PR→merge→submodule→image→apply**                         | RULE 11 |

> Full text: call `/principle`.

---

## Team structure (v5.0.0 — 20 SDLC role agents)

`openindu-maintainers` has **20 agents**, all via the public plugin. The SDLC pipeline:

```mermaid
graph LR
    subgraph PIPELINE["SDLC pipeline"]
        BA[business-analyst] --> PM[product-manager] --> ARCH[architect] --> UX[ui-ux-designer]
        UX --> FE[frontend]
        UX --> BE[backend]
        UX --> EDGE[edge]
        UX --> SC[station-control]
        FE --> OPS[ops]
        BE --> OPS
        EDGE --> OPS
        SC --> OPS
        OPS --> BI[bi-analyst]
    end

    CA["codebase-analyst<br/>read-only, any stage"] -.-> PIPELINE
    GOV["governance<br/>manager / arbiter / inspector / control-tower"] -. cross-cuts .-> PIPELINE
    QUAL["quality<br/>test / reviewer / security"] -. cross-cuts .-> PIPELINE
```

| Domain     | Agents                                     |
| ---------- | ------------------------------------------ |
| Governance | manager, arbiter, inspector, control-tower |
| Ideation   | business-analyst, product-manager          |
| Design     | architect, ui-ux-designer                  |
| Build      | frontend, backend, edge, station-control   |
| Quality    | test, reviewer, security                   |
| Data       | data, bi-analyst                           |
| Operations | ops, release                               |
| Insight    | codebase-analyst                           |

All agents are pure role+skill, **zero business binding**. `/launch` activates the relevant subset per repo (by `route.json` language/modules). See [`plugins/openindu-control-tower/agents/`](./plugins/openindu-control-tower/agents/).

### Startup

```
/launch
```

Auto-detects team state: creates + spawns manager if absent; messages if manager is online. See [`team/STARTUP.md`](./team/STARTUP.md).

---

## Commands & workflows (16 skills)

Each is `plugins/openindu-control-tower/skills/<name>/SKILL.md`. 11 of the 16 carry
`disable-model-invocation: true` — the model never triggers them from conversation context, only
an explicit `/<name>` call does. The 5 marked **\*** below have no such flag and may be
auto-invoked. Every skill's first line of work is `/principle` (RULE 1); omitted from the
"Input" column below since it's constant across all 16.

### Reference (read-only, no writes)

| Command             | Input                          | Output                                                                                                                                                                                            |
| ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/principle` **\*** | none                           | the 11 RULEs loaded into context — no file write, no side effect                                                                                                                                  |
| `/route` **\***     | optional `<repo name or type>` | a routing answer read from `route.json` (URL / type / host / image / domain / aggregate ownership / K8s namespace) + 3 derived judgments (which PR flow, does it need `/build`, can it touch K8s) |

### SDLC pipeline orchestration

| Command      | Input                                            | Output                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/launch`    | optional `[initial task description]`            | the `openindu-maintainers` team brought up — manager spawned (or messaged if already up) with a role roster activated by the current repo's language; no file artifact, state lives in `~/.claude/teams/openindu-maintainers/`                                                                              |
| `/design`    | `<feature description>`                          | the `design/<domain>/` artifact tree, written phase by phase (business-analyst → product-manager → architect → ui-ux-designer → build role → ops → bi-analyst), each phase gated by a human STOP; ends with working code + a passing `/delivery-check`                                                      |
| `/autopilot` | `<idea> [--tier L0\|L1\|L2\|L3]`                 | the same artifact tree as `/design` (it wraps `/design`), but the STOP policy is tier-controlled — L0 gates every phase, L1 gates only the ends, L2 auto-syncs to staging behind one STOP, L3 runs end to end to a sandbox deploy with one final notification. RULE 4/7/8/10 are never relaxed by the tier. |
| `/design-md` | `[--pick <brand> \| --generate "<description>"]` | `design/uiux/DESIGN.md` — a 9-section design-system document (palette / type / components / layout / depth / do's-and-don'ts / responsive / agent-prompt guide) that becomes ui-ux-designer's and frontend's source of truth                                                                                |

### Org-wide batch pipelines (deterministic engine, spec/005)

| Command           | Input                                                                                                                                                                        | Output                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/issue-pipeline` | `[--org openIndu] [--tier L1] [--dry-run]`                                                                                                                                   | an adjudicated, prioritized queue over every open issue in the org (`ACTION` / `NEEDS_TRIAGE` / `NO_ACTION`, each with an independent adversarial review); accepted items are dispatched through `/autopilot`; ends with a per-issue status table (`NO_ACTION` / `NEEDS_TRIAGE` / `PR_GREEN` / `BLOCKED` / `FAILED` / `PENDING_APPROVAL`) — never merges anything itself                                                                    |
| `/dev`            | `--repo <repo> [--dry-run \| --resume <run-id> \| --no-merge \| --max-issues N \| --max-total-budget-usd N]`, or the subcommands `ack <run-id>` / `build <repo> [--confirm]` | one JSON result object + a process exit code (0-5, `dev.schema.json`); a completed run's `RUN_COMPLETE` carries a rendered acceptance-matrix report. May open, review, and — only when the target repo has a live, unexpired `dev_grants` entry — merge PRs against that repo's own open issues, entirely through engine code (`plugins/openindu-control-tower/engine/`) with zero ad hoc agent judgment over the GitHub writes themselves. |

### Release & delivery (RULE 11)

| Command                  | Input                                      | Output                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/build`                 | `<service-name> [--tag <tag>] [--dry-run]` | a Docker image built and pushed to the Aliyun Container Registry (RULE 11 step ④); `--dry-run` only validates the Dockerfile and pushes nothing                                             |
| `/delivery-check` **\*** | optional `[repo name or PR link]`          | a rendered 6-box RULE 11 checklist (① sub-repo PR → ⑥ `kubectl apply`) with ✅ / ⏳ / N/A per box and a Complete / Partially-complete verdict — a report returned to the thread, not a file |

### Governance & self-maintenance (control-tower repo)

| Command         | Input                                                                                                 | Output                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/adopt`        | `[--dry-run]` — operates on whatever repo the session is in, no repo argument                         | with `--dry-run`: a table only, zero writes; otherwise a PR against that repo adding the plugin reference to `.claude/settings.json`, rewriting Rule #1 to call `/principle`, plus a user-confirmed deletion list for duplicate governance assets            |
| `/spec-new`     | `<feature brief>`                                                                                     | `spec/NNN-brief-slug.md` (9 sections: background / design points / impact / phased path / rollback / acceptance / self-check / open questions / changelog), submitted to arbiter review; on approval, `status: finalized` + an index row in `spec/README.md` |
| `/revision-new` | `<change brief>`                                                                                      | `revision/YYYY-MM-DD-brief-slug.md` — a 4-section changelog record (summary / files involved / trigger / impact) with a 3-item verification checklist                                                                                                        |
| `/memory`       | `[--read <role> \| --add <role> "<lesson>"]` — also read implicitly by every agent at its own startup | read: a role's lesson text surfaced into context; write: one appended line in `team/communications/memory/<role>/{pitfalls,techniques}.md`                                                                                                                   |

### Standalone analysis

| Command                     | Input                                     | Output                                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/codebase-analysis` **\*** | a target codebase (current repo or named) | one markdown report (`<ProjectName>分析报告.md`, project root), following the 7-step flow: problem → feature-to-problem map → components → code deep-dive → architecture → 4+1 views → doc                                                                                     |
| `/company-analysis` **\***  | a company name or description             | one markdown company-profile report — either the full 11-section report or the compact recurring "每日公司观察" variant; business-analyst's market/competitor-research tool, oriented toward openIndu's own technical-community domain when the audience is engineering-facing |

---

## Directory structure

```
control-tower/
├── README.md
├── README_ZH.md                      # Chinese version
├── CLAUDE.md                         # this file
├── route.json                        # sync product (sole source in the plugin)
├── .claude/settings.json            # references the public plugin
├── .claude-plugin/marketplace.json  # marketplace catalog
├── plugins/openindu-control-tower/       # ★ public Claude Code plugin (org-wide)
│   ├── .claude-plugin/plugin.json
│   ├── skills/                      # 16: principle / adopt / launch / design / autopilot / memory / design-md / delivery-check / route / spec-new / revision-new / codebase-analysis / build / company-analysis / dev / issue-pipeline
│   ├── agents/                      # 20 agents (SDLC roles, zero business binding)
│   ├── engine/                      # deterministic /dev engine (spec/005): states / guards / admission / carrier / pr-lifecycle etc., one .mjs + one .test.mjs each
│   ├── evals/                       # eval suites: dev-reasoning-layer (spec/005) + standing-authorization (spec/006)
│   ├── hooks/                       # trunk protection (RULE 7)
│   ├── reference/                   # route.json (sole source) + dev.schema.json + manifest.yaml + coding-standards/
│   └── README.md
├── scripts/                          # sync-route / check-roster / check-version-bump / detect-modules
├── .github/workflows/ci.yml         # prettier + plugin validate + route + roster consistency
├── spec/                            # feature designs (control-tower design → arbiter review)
├── revision/                        # change records (changelog)
└── team/                            # team docs + comms threads
```

---

## Hooks

The trunk-protection hook is built into the public plugin (`plugins/openindu-control-tower/hooks/`); repos with the plugin get it automatically.

| Hook            | Event                          | Effect                                     |
| --------------- | ------------------------------ | ------------------------------------------ |
| Block push main | `PreToolUse` (Bash/PowerShell) | exit 2 blocks push to main/master (RULE 7) |

Repos may add repo-specific hooks (e.g. `PostToolUse` auto-lint) in their own `.claude/settings.json`; no conflict with the plugin hook.

---

## Pre-submit checks

```bash
npx prettier --check "**/*.md"
claude plugin validate ./plugins/openindu-control-tower --strict
node scripts/sync-route.mjs --check
node scripts/check-roster.mjs
```

All four run in CI on PR (`.github/workflows/ci.yml`).

> After editing plugin content, bump `version` in `plugin.json` and `marketplace.json`, or downstream `/plugin update` won't pick it up.
