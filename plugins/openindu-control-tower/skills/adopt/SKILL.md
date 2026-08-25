---
name: adopt
description: Onboard the current openIndu repo to the public workflow plugin and converge duplicate governance assets (principle copies, duplicate governance agents, ghost /launch commands). Use when a sub-repo first introduces the public principles or has a self-hosted principle.md / PRINCIPLE.md copy.
argument-hint: "[--dry-run]"
disable-model-invocation: true
---

# /adopt — Onboard a sub-repo to the public principles

Wire the current repo to `openindu-control-tower@openindu` so it shares the org's principle set, governance agents, and skills.

**Call `/principle` first** (RULE 1). Deletions here are L2, need human review (RULE 4); changes to completed artifacts need prior user notice (RULE 6).

---

## Step 1 — Confirm repo identity

```bash
git remote -v
git rev-parse --show-toplevel
git status --short
```

- Dirty working tree → **stop**; user cleans first.
- Remote not under `github.com/openIndu` or `gitee.com/openIndu` → **stop and ask**; this plugin serves only openIndu org.

Use `/route` to confirm this repo's type (backend / frontend / aggregate / gitops / tooling / platform / application / edge).

## Step 2 — Create branch (RULE 7)

```bash
git checkout -b chore/adopt-openindu-control-tower
```

Never edit on `main` / `master`.

## Step 3 — Write the plugin reference

Edit `.claude/settings.json` (**merge**, don't overwrite existing keys):

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

If the file doesn't exist, create it. Existing `permissions` / `hooks` **must be preserved as-is**.

> `infra-deploy` is on Gitee, but the plugin source is still GitHub's control-tower repo — marketplace source is host-agnostic.

## Step 4 — Rule #1 → public principles

At the top of the repo's `CLAUDE.md` (or `AGENTS.md` if absent), replace any principle section with:

```markdown
## Rule #1 — Agent behavior principles

This repo follows openIndu's unified principles (11 RULEs), provided by the public plugin `openindu-control-tower@openindu`.

**First step of any task: call `/principle` to load the principles.**

This repo **must not** self-host a principle copy. Principle changes go through `openIndu/control-tower`'s spec + arbiter review.
```

Key: **use `/principle` (a call), not a relative path.** `../principle.md` doesn't resolve in a sub-repo — that's why the old scheme failed.

## Step 5 — Inventory duplicate assets (list, don't delete)

Scan for governance assets duplicated with the public layer:

| Scan target                                                                | Verdict                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `.claude/PRINCIPLE.md` `.claude/governance/principle.md` `**/principle.md` | principle copy → **delete**, replaced by `/principle` |
| `.claude/agents/**` manager / arbiter / inspector / coordinator            | governance-agent dup → **delete**                     |
| `.claude/commands/launch.md` `**/launch.sh`                                | replaced by `/launch` → **delete**                    |
| `.claude/team/manifest.yaml`                                               | 编排配置 dup → **delete**                             |
| other business/dev agents + skills                                         | **keep**; see boundary below                          |

For each principle copy, run a diff before concluding:

```bash
git log --oneline -5 -- <copy-path>
```

If the copy has content the public principle **doesn't**, that's a repo-specific constraint — don't drop it; fold it into the repo's `CLAUDE.md` "repo-specific constraints" section, or file a spec to upstream it as RULE 12+.

### Convergence boundary

The public plugin provides 20 SDLC role agents (governance/ideation/design/build/quality/data/operations/insight). `/adopt` only converges **governance duplicates** (manager/arbiter/inspector/control-tower) and L0 junk.

**Don't delete** a sub-repo's specialized dev agents + their scripts — e.g. UI/UX, business-analyst, ops bound to that repo's stack, with Python scripts/templates. The public layer may have **no equivalent**; deletion is a net loss.

One-line判据: delete only the "public layer already does the same thing" copy; keep the "public layer has no equivalent" one. For roles where the public layer now has an equivalent (e.g. local `backend-developer`=Spring ↔ public `backend`), folding is a spec/002 §8 "上收评估" decision, not a /adopt delete.

## Step 6 — 🛑 Stop, await user confirmation

Present a table to the user; await explicit confirmation before deleting anything (RULE 4 L2 / RULE 6):

```
Onboarding changes:
  ✅ .claude/settings.json      add extraKnownMarketplaces + enabledPlugins
  ✅ CLAUDE.md                  Rule #1 → /principle

Suggested deletions (awaiting your confirmation):
  ❓ .claude/PRINCIPLE.md                  6 RULEs; public has 11
  ❓ .claude/agents/manager/AGENT.md       dup of openindu-control-tower:manager
  ❓ .claude/commands/launch.md            dup of /launch

Keep untouched:
  ✔ .claude/agents/ui-ux-designer/        no public equivalent (or fold via spec)
  ✔ .claude/skills/<repo-specific>/        repo-specific
```

With `--dry-run`, **only output this table**; no writes.

## Step 7 — Verify

```bash
/reload-plugins
```

Confirm:

- `/principle` callable, outputs 11 RULEs
- `@openindu-control-tower:` shows 20 agents
- on a test branch, `git push origin main` is blocked by the hook (RULE 7)

## Step 8 — Open PR

```bash
git add -A
git commit -m "chore: onboard to openindu-control-tower public principle plugin"
git push -u origin chore/adopt-openindu-control-tower
```

PR description lists: what was onboarded, what deleted, why, what kept.

> **Gitee repos (infra-deploy)**: PR title/body must be English (RULE 9).
