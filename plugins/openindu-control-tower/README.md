# openindu-control-tower

The openIndu community's org-wide workflow package — one principle set, 20 maintainer agents (governance / ideation / design / build / quality / data / operations / insight, zero business binding), workflow skills, and a main-branch protection hook. Claude Code uses `/skill`; Codex uses `$skill` through its plugin package. Zero-copy reuse across all openIndu repos.

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

| Command                     | Purpose                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `/principle`                | **Sole source of the 11 Agent behavior RULEs** (Rule #1 entry)                                  |
| `/adopt`                    | Onboard a repo to the plugin + converge duplicate governance assets                             |
| `/launch`                   | Bring up the `openindu-maintainers` team                                                        |
| `/design`                   | Orchestrate the 0-to-1 SDLC pipeline across roles                                               |
| `/autopilot`                | Run the pipeline at a chosen autonomy tier (L0-L3)                                              |
| `/issue-pipeline`           | Triage organization Issues, adversarially review, then dispatch                                 |
| `/pr_merge <openIndu/repo>` | Inspect and serially merge eligible PRs with current approval, strict required CI and read-back |
| `/dev`                      | Implement one accepted task and hand off its exact source SHA to `/test`                        |
| `/research`                 | Market and competitor research with evidence-backed differentiation and experiments             |
| `/prod`                     | Define the scoped product requirements, MVP and acceptance matrix                               |
| `/test`                     | Run UT/IT, start the local app, manually verify acceptance and retain evidence                  |
| `/publish`                  | Prepare and reconcile an infra-deploy Gitee release PR from a verified immutable image          |
| `/dev_issue`                | Process one repo's Issues through research, product, development, testing and green PRs         |
| `/design-md`                | Adopt a DESIGN.md design system for UI work                                                     |
| `/memory`                   | Read/write the team's reusable lessons ledger                                                   |
| `/build`                    | Build + push a Docker image to the registry (RULE 11 step ④)                                    |
| `/delivery-check`           | RULE 11 delivery-pipeline completeness self-check                                               |
| `/route`                    | Query repo location, type, image, domain, PR flow                                               |
| `/spec-new`                 | Draft a spec design (control-tower)                                                             |
| `/revision-new`             | Draft a revision record (control-tower)                                                         |
| `/codebase-analysis`        | 7-step codebase analysis methodology (used by codebase-analyst)                                 |
| `/company-analysis`         | Evidence-led company research using Five Forces, SWOT, and DuPont                               |

### Workflow boundaries

`/research` → `/prod` → `/dev` → `/test` is the task-stage handoff. Runtime evidence lives in the isolated task directory; optional design documents committed to a repo are versioned copies whose paths and hashes are recorded in that evidence. `/dev_issue <repo>` wraps the stages for one repository's Issues and stops at PR_GREEN; `/issue-pipeline` is the organization-scope intake and dispatch path, and requires the visible repository inventory to match canonical GitHub entries in `route.json`. Neither merges PRs. `/pr_merge <repo>` handles only PRs with current human approval and required checks. `/autopilot` changes workflow STOP points only and never merges a PR. `/build` requires a registered image target; `/publish` prepares the infra-deploy PR; a human performs cluster apply.

`/design` is the phase-gated feature pipeline. `/autopilot` changes its STOP policy only; L2/L3 require a verified non-production target and never override review or risk authorization.

The Claude Code manifest is `.claude-plugin/plugin.json`. The Codex compatibility manifest is `.codex-plugin/plugin.json` at the repository root; it exposes `.agents/skills/` wrappers that map to canonical skills. Invoke skills as `$dev` in Codex; literal `/dev` remains a Claude Code command.

### Agents (20)

Installed agents appear in the `@` list with the `openindu-control-tower:` prefix — no clash with repo-local agents.

| Agent                                     | Domain     | Role                                                                              |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `openindu-control-tower:manager`          | Governance | Classify/dispatch/track tasks; resolve ordinary workflow exceptions within policy |
| `openindu-control-tower:arbiter`          | Governance | Cross-repo arbitration, spec review (narrowed)                                    |
| `openindu-control-tower:inspector`        | Governance | Proactive read-only inspection, improvement proposals                             |
| `openindu-control-tower:control-tower`    | Governance | Maintains the brain: principles / route / agents / plugin                         |
| `openindu-control-tower:business-analyst` | Ideation   | Market research, competitor analysis, business case                               |
| `openindu-control-tower:product-manager`  | Ideation   | Requirements, PRDs, acceptance criteria, cross-repo contracts                     |
| `openindu-control-tower:architect`        | Design     | Tech selection, system architecture, ADRs, roadmap                                |
| `openindu-control-tower:ui-ux-designer`   | Design     | Interaction, visual, design system, accessibility                                 |
| `openindu-control-tower:frontend`         | Build      | Frontend: React / Vue / UniApp (zero business binding)                            |
| `openindu-control-tower:backend`          | Build      | Backend: Spring Boot / FastAPI (zero business binding)                            |
| `openindu-control-tower:edge`             | Build      | Edge: Rust / field-protocol drivers (silent-failure risk)                         |
| `openindu-control-tower:station-control`  | Build      | Station & control: C# / .NET / physical devices (default L3)                      |
| `openindu-control-tower:test`             | Quality    | RULE 2 admission gate (regression judgment, not coverage)                         |
| `openindu-control-tower:reviewer`         | Quality    | RULE 5.2 four-lens pre-review (no approval authority)                             |
| `openindu-control-tower:security`         | Quality    | RULE 5.4 credentials / permissions / exposure surface                             |
| `openindu-control-tower:data`             | Data       | RULE 10 production-SQL protection (plans, human executes)                         |
| `openindu-control-tower:bi-analyst`       | Data       | Metrics, dashboards, experimentation (makes reqs measurable)                      |
| `openindu-control-tower:ops`              | Operations | Day-2 ops: server/db health, logs, runbooks, incidents                            |
| `openindu-control-tower:release`          | Operations | RULE 11 six-stage pipeline + gitops K8s manifests                                 |
| `openindu-control-tower:codebase-analyst` | Insight    | Reverse-engineer/onboard to any repo (read-only, 7-step)                          |

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

Then **bump `version` consistently in `plugins/openindu-control-tower/.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and `.claude-plugin/marketplace.json`** — without a synchronized bump, downstream Claude Code or Codex installs may not receive the update. `node scripts/check-version-bump.mjs` validates the three values and the required increment. Merge via PR (RULE 7).

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
