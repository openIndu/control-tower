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

```
control-tower (brain)
        │  .claude-plugin/marketplace.json
        │  plugins/openindu-control-tower/  (principles + 20 agents + 12 skills + hook)
        ▼
each repo's .claude/settings.json references 6 lines → clone即生效 → /plugin update pulls updates
        │
   ┌────┴────┬──────────┬──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼          ▼
aggregate  backend  admin/portal  studio  platform  infra-deploy …
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

```
business-analyst → product-manager → architect → ui-ux-designer → [frontend/backend/edge/station-control] → ops → bi-analyst
                                          ↑ codebase-analyst (read-only, any stage)
governance (manager/arbiter/inspector/control-tower) + quality (test/reviewer/security) cross-cut
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
│   ├── skills/                      # principle / adopt / launch / design / autopilot / memory / design-md / delivery-check / route / spec-new / revision-new / codebase-analysis
│   ├── agents/                      # 20 agents (SDLC roles, zero business binding)
│   ├── hooks/                       # trunk protection (RULE 7)
│   ├── reference/                   # route.json (sole source) + manifest.yaml
│   └── README.md
├── scripts/sync-route.mjs            # route.json single-source sync / check
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
