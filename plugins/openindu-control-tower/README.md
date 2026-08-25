# openindu-control-tower

The openIndu community's org-wide Claude Code plugin — one principle set, 20 maintainer agents (governance / ideation / design / build / quality / data / operations / insight, zero business binding), workflow skills, and a main-branch protection hook. Zero-copy reuse across all openIndu repos.

## Install

```bash
/plugin marketplace add openIndu/control-tower
/plugin install openindu-control-tower@openindu
```

Or run `/adopt` in a repo — it writes the block below into `.claude/settings.json` and opens a PR, so everyone who clones the repo gets it:

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

## Contents

### Skills

| Command              | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `/principle`         | **Sole source of the 11 Agent behavior RULEs** (Rule #1 entry)      |
| `/adopt`             | Onboard a repo to the plugin + converge duplicate governance assets |
| `/launch`            | Bring up the `openindu-maintainers` team                            |
| `/design`            | Orchestrate the 0-to-1 SDLC pipeline across roles                   |
| `/autopilot`         | Run the pipeline at a chosen autonomy tier (L0-L3)                  |
| `/design-md`         | Adopt a DESIGN.md design system for UI work                         |
| `/memory`            | Read/write the team's reusable lessons ledger                       |
| `/delivery-check`    | RULE 11 delivery-pipeline completeness self-check                   |
| `/route`             | Query repo location, type, image, domain, PR flow                   |
| `/spec-new`          | Draft a spec design (control-tower)                                 |
| `/revision-new`      | Draft a revision record (control-tower)                             |
| `/codebase-analysis` | 7-step codebase analysis methodology (used by codebase-analyst)     |

### Agents (20)

Installed agents appear in the `@` list with the `openindu-control-tower:` prefix — no clash with repo-local agents.

| Agent                                     | Domain     | Role                                                          |
| ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| `openindu-control-tower:manager`          | Governance | Classify/dispatch/track tasks, policy exceptions              |
| `openindu-control-tower:arbiter`          | Governance | Cross-repo arbitration, spec review (narrowed)                |
| `openindu-control-tower:inspector`        | Governance | Proactive read-only inspection, improvement proposals         |
| `openindu-control-tower:control-tower`    | Governance | Maintains the brain: principles / route / agents / plugin     |
| `openindu-control-tower:business-analyst` | Ideation   | Market research, competitor analysis, business case           |
| `openindu-control-tower:product-manager`  | Ideation   | Requirements, PRDs, acceptance criteria, cross-repo contracts |
| `openindu-control-tower:architect`        | Design     | Tech selection, system architecture, ADRs, roadmap            |
| `openindu-control-tower:ui-ux-designer`   | Design     | Interaction, visual, design system, accessibility             |
| `openindu-control-tower:frontend`         | Build      | Frontend: React / Vue / UniApp (zero business binding)        |
| `openindu-control-tower:backend`          | Build      | Backend: Spring Boot / FastAPI (zero business binding)        |
| `openindu-control-tower:edge`             | Build      | Edge: Rust / field-protocol drivers (silent-failure risk)     |
| `openindu-control-tower:station-control`  | Build      | Station & control: C# / .NET / physical devices (default L3)  |
| `openindu-control-tower:test`             | Quality    | RULE 2 admission gate (regression judgment, not coverage)     |
| `openindu-control-tower:reviewer`         | Quality    | RULE 5.2 four-lens pre-review (no approval authority)         |
| `openindu-control-tower:security`         | Quality    | RULE 5.4 credentials / permissions / exposure surface         |
| `openindu-control-tower:data`             | Data       | RULE 10 production-SQL protection (plans, human executes)     |
| `openindu-control-tower:bi-analyst`       | Data       | Metrics, dashboards, experimentation (makes reqs measurable)  |
| `openindu-control-tower:ops`              | Operations | Day-2 ops: server/db health, logs, runbooks, incidents        |
| `openindu-control-tower:release`          | Operations | RULE 11 six-stage pipeline + gitops K8s manifests             |
| `openindu-control-tower:codebase-analyst` | Insight    | Reverse-engineer/onboard to any repo (read-only, 7-step)      |

The SDLC pipeline: `business-analyst → product-manager → architect → ui-ux-designer → build → ops → bi-analyst` (codebase-analyst read-only at any stage; governance/quality cross-cut). `/launch` activates the relevant subset per repo.

### Hook

`PreToolUse` (matches `Bash` / `PowerShell`) blocks `git push` to `main` / `master`, exit 2 (RULE 7). Covers:

- `git push origin main`
- `git push -f origin HEAD:master`
- `git push --set-upstream origin +refs/heads/main`
- compound commands `git status && git push origin main`
- bare `git push` / `git push -u origin` when the current branch is `main`

On internal error it fails open and explains on stderr — the hook must not brick the session. The real backstop is branch protection on GitHub / Gitee.

## On agent tool permissions

Governance agents (manager / arbiter / inspector) state "do not modify any repo file directly" in their behavior constraints but have **no** `disallowedTools` write restriction. Reason: their comms protocol requires writing review decisions / proposals / dispatches to `team/communications/threads/`; frontmatter tool limits are global and can't be path-scoped, so a blanket write-ban would sever the protocol.

Restraint is enforced by explicit prompt rules; overreach is caught by PR review (RULE 5.2).

## Editing this plugin

Only the `control-tower` agent in the `control-tower` repo maintains this plugin.

| Change what   | Edit where                                                 |
| ------------- | ---------------------------------------------------------- |
| A principle   | `skills/principle/SKILL.md` (sole source)                  |
| Routing       | `reference/route.json`, then `node scripts/sync-route.mjs` |
| An agent      | `agents/<name>.md`                                         |
| Team manifest | `reference/manifest.yaml`                                  |

After edits, always:

```bash
claude plugin validate ./plugins/openindu-control-tower --strict
node scripts/sync-route.mjs --check
node scripts/check-roster.mjs
npx prettier --check "**/*.md"
```

Then **bump `version` in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`** — without a bump, downstream `/plugin update` won't pick it up. Merge via PR (RULE 7).

## Local dev

```bash
/plugin marketplace add ./          # override the github market with a local copy
/reload-plugins                     # agent/hook changes need a reload; skill text is live
```

Switch back:

```bash
/plugin marketplace add openIndu/control-tower
```

The later-added market wins, so you can toggle freely.
