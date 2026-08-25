# openIndu — Control Tower

> **Language:** English | [中文](README_ZH.md)

> The **control center** of the openIndu community's AI end-to-end development workflow — an independent "brain" separate from business repos. It maintains cross-repo routing, Agent behavior principles, and Agent prompts, and distributes these assets to every repo in the org as a **Claude Code plugin**.

---

## Quick start

In any openIndu repo:

```bash
/plugin marketplace add openIndu/control-tower
/plugin install openindu-control-tower@openindu
```

Or more thoroughly — run `/adopt` once in the target repo. It writes the plugin reference into `.claude/settings.json`, points Rule #1 at `/principle`, and lists duplicate principle copies and governance agents for you to confirm deletion.

Available immediately after onboarding:

| Command           | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `/principle`      | Load the 11 Agent behavior principles (Rule #1)            |
| `/route`          | Look up repo location, image, domain, which PR flow to use |
| `/launch`         | Bring up the `openindu-maintainers` team                   |
| `/design`         | Orchestrate the 0-to-1 SDLC pipeline across roles          |
| `/autopilot`      | Run the pipeline at a chosen autonomy tier (L0-L3)         |
| `/design-md`      | Adopt a DESIGN.md design system for UI work                |
| `/memory`         | Read/write the team's reusable lessons ledger              |
| `/delivery-check` | Self-check the RULE 11 delivery pipeline completeness      |
| `/adopt`          | Onboard a repo and converge duplicate governance assets    |

Plus **20 agents** (governance / ideation / design / build / quality / data / operations / insight, zero business binding) and a hook that blocks `git push origin main`.

---

## Core positioning

```
        ┌──────────────────────────────────┐
        │  openIndu Control Tower          │
        │      (this repo — the brain)     │
        │                                  │
        │  · plugins/openindu-control-tower/    │
        │      ├─ 11 principles (sole src)│
        │      ├─ 20 SDLC role agents     │
        │      ├─ 12 workflow skills      │
        │      └─ trunk-protection hook   │
        │  · route.json (repo routing, data)│
        │  · spec/ revision/ design & change│
        └────────────┬─────────────────────┘
                     │ plugin distribution (/plugin update)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   any openIndu repo        decided by route.json
   (agents by role+language) (adding a repo never touches the brain)
```

The dependency direction is **one-way**: downstream depends on the control layer's abstractions (principles, agent responsibilities, workflow); the control layer never depends on downstream concrete instances.

| Position                           | Description                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Brain**                          | Maintains repo-type contracts and agent role definitions; concrete instances are data in `route.json`        |
| **Distribution hub**               | The public plugin `openindu-control-tower@openindu` ships principles, agents, skills, and hooks to all repos |
| **Authoritative principle source** | `/principle` is every agent's Rule #1; the 11 RULEs are maintained by the openIndu community                 |
| **Spec designer**                  | Feature designs in `spec/` get a first pass by control-tower, then finalized after arbiter review            |

---

## Repo types (abstraction)

The control layer **does not enumerate concrete repos**. This repo only defines repo **types and contracts**; which repos exist, what their images/domains are — that's data, queried at runtime via `/route`.

| Type               | Contract                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| `control-tower`    | The sole source of principles, agent definitions, and the public plugin          |
| `aggregate`        | Submodule aggregation, drives image builds, relay in the delivery pipeline       |
| `backend`          | Server-side app, produces images, has a `.env.example` contract                  |
| `frontend`         | Static site, produces images, has a domain and nginx config                      |
| `gitops`           | The single home for K8s manifests; only this type may contain prod YAML (RULE 8) |
| Product-line types | `platform` / `tooling` / `application` / `edge`; release styles defined per type |

> **Why the repo list was removed**: the control layer enumerating downstream instances is a dependency inversion — adding a repo would force editing the brain's docs, so the brain ends up depending on the leaves. Types are abstractions (stable); instances are data (mutable).
>
> Adding a repo only requires a new entry in `plugins/openindu-control-tower/reference/route.json` + a `revision/` record — **this file stays untouched**. The table above only changes when a brand-new repo _type_ appears, and that goes through `/spec-new`.

**Boundary note**: the `gitops`-type repo lives on Gitee; its PR titles/bodies use English (RULE 9). All K8s manifest changes must go through it (RULE 8).

---

## Agent behavior principles (11)

Call `/principle` for the full text. Summary:

| RULE | Title                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | Principles first (call `/principle` as the first step)                                          |
| 2    | Engineering fundamentals first (CI / tests / security scanning must pass before agents)         |
| 3    | Automation first (scripts > LLM; only escalate to the level just sufficient)                    |
| 4    | Human-AI collaboration tiers (L0–L3 authorization matrix + the three "ables")                   |
| 5    | Validate · Review · Collaborate · Secure (eval/trace/CODEOWNERS/least-privilege)                |
| 6    | Completed artifacts are immutable (threads/specs/templates can't be edited before confirmation) |
| 7    | Git trunk protection (no push to main; everything via PR)                                       |
| 8    | K8s manifests belong only in infra-deploy                                                       |
| 9    | Gitee PR titles/bodies in English                                                               |
| 10   | Production SQL: multi-column WHERE + BEFORE/AFTER + conditional commit                          |
| 11   | After a fix, run the full delivery pipeline (PR→merge→submodule→image→apply)                    |

---

## Team structure (v5.0.0 — 20 SDLC role agents)

The `openindu-maintainers` team has **20 agents**, all provided by the public plugin. The SDLC pipeline:

```
business-analyst → product-manager → architect → ui-ux-designer → [frontend/backend/edge/station-control] → ops → bi-analyst
                                          ↑ codebase-analyst (read-only, any stage)
governance (manager/arbiter/inspector/control-tower) + quality (test/reviewer/security) cross-cut
```

| Domain     | Agent                | Core responsibility                                 |
| ---------- | -------------------- | --------------------------------------------------- |
| Governance | **manager**          | Classify/dispatch/track tasks, policy exceptions    |
| Governance | **arbiter**          | Cross-repo arbitration, spec review                 |
| Governance | **inspector**        | Proactive inspection                                |
| Governance | **control-tower**    | Principles / routing / agent definitions / plugin   |
| Ideation   | **business-analyst** | Market research, competitor analysis, business case |
| Ideation   | **product-manager**  | Requirements, PRDs, acceptance criteria, contracts  |
| Design     | **architect**        | Tech selection, system architecture, ADRs           |
| Design     | **ui-ux-designer**   | Interaction, visual, design system, accessibility   |
| Build      | **frontend**         | React / Vue / UniApp (zero business binding)        |
| Build      | **backend**          | Spring Boot / FastAPI (zero business binding)       |
| Build      | **edge**             | Rust / field-protocol drivers                       |
| Build      | **station-control**  | C# / .NET / physical devices (default L3)           |
| Quality    | **test**             | RULE 2 admission gate                               |
| Quality    | **reviewer**         | RULE 5.2 four-lens pre-review                       |
| Quality    | **security**         | RULE 5.4 credentials / permissions / exposure       |
| Data       | **data**             | RULE 10 production-SQL protection                   |
| Data       | **bi-analyst**       | Metrics, dashboards, experimentation                |
| Operations | **ops**              | Day-2 ops: server/db/logs/runbooks                  |
| Operations | **release**          | RULE 11 six-stage delivery + K8s manifests          |
| Insight    | **codebase-analyst** | Reverse-engineer/onboard to any repo (read-only)    |

Definitions in [`plugins/openindu-control-tower/agents/`](./plugins/openindu-control-tower/agents/). All agents are pure role+skill, **zero business binding**; `/launch` activates the relevant subset per repo (by `route.json` language/modules).

### Startup

```
/launch
```

Auto-detects team state: creates + spawns manager if absent; sends a message if manager is already online. See [`team/STARTUP.md`](./team/STARTUP.md).

---

## Directory structure

```
control-tower/
├── README.md
├── README_ZH.md                      # Chinese version
├── CLAUDE.md                         # Project Claude context
├── route.json                        # Sync product (sole source in the plugin)
├── .claude/settings.json            # References the public plugin
├── .claude-plugin/marketplace.json  # Marketplace catalog
├── plugins/openindu-control-tower/       # ★ Public Claude Code plugin
│   ├── .claude-plugin/plugin.json
│   ├── skills/                      # 12 skills (principle + 11 workflow)
│   ├── agents/                      # 20 agents (SDLC roles, zero business binding)
│   ├── hooks/                       # Trunk protection
│   ├── reference/                   # route.json + manifest.yaml
│   └── README.md
├── scripts/sync-route.mjs
├── .github/workflows/ci.yml
├── spec/                            # Feature designs
├── revision/                        # Change records
└── team/                            # Team docs + comms threads
```

---

## Maintenance & evolution

- **Edit a principle**: only edit `plugins/openindu-control-tower/skills/principle/SKILL.md`; go through `/spec-new` → arbiter review → `/revision-new` → PR
- **Edit routing**: only edit `plugins/openindu-control-tower/reference/route.json`, then `node scripts/sync-route.mjs`
- **Add an agent**: create a file under `plugins/openindu-control-tower/agents/` → register in `reference/manifest.yaml` → update listings → bump version
- **Add a skill**: create `plugins/openindu-control-tower/skills/<name>/SKILL.md` → bump version
- **Release**: after edits, bump `version` in both `plugin.json` and `marketplace.json`, otherwise downstream `/plugin update` won't pick it up
- **PR enforced**: this repo is protected by RULE 7; the plugin hook blocks pushes to main

Run before submitting:

```bash
npx prettier --check "**/*.md"
claude plugin validate ./plugins/openindu-control-tower --strict
node scripts/sync-route.mjs --check
node scripts/check-roster.mjs
```

---

## Contributing

- Workflow pain points / improvement proposals: file an issue in this repo
- Principle additions: go through `/spec-new` + PR
- Agent behavior tweaks: edit `plugins/openindu-control-tower/agents/*.md`, open a PR
- New skill: create `plugins/openindu-control-tower/skills/<name>/SKILL.md`, open a PR

All changes go through PR; pushing directly to main is forbidden.

---

## License

[Apache License 2.0](LICENSE) — matches the `license` field already declared in
`plugins/openindu-control-tower/.claude-plugin/plugin.json`, and is consistent with the
Apache-2.0 licensing of the other openIndu core repos.
