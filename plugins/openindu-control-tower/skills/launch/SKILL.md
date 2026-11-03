---
name: launch
description: Bring up the openindu-maintainers team and spawn manager. Use for cross-repo coordination or when manager/arbiter need the full review-dispatch flow.
argument-hint: "[initial task description]"
disable-model-invocation: true
---

# /launch — Bring up the openIndu team

Start the `openindu-maintainers` team and spawn manager. Repeat-safe: running again sends a message if the team exists, doesn't re-spawn.

**Call `/principle` first** (RULE 1).

---

## 1. Detect team state

```bash
ls "$HOME/.claude/teams/openindu-maintainers/config.json" 2>/dev/null && echo EXISTS || echo ABSENT
```

Windows PowerShell:

```powershell
if (Test-Path "$env:USERPROFILE\.claude\teams\openindu-maintainers\config.json") { "EXISTS" } else { "ABSENT" }
```

| Result   | Action                                                      |
| -------- | ----------------------------------------------------------- |
| `ABSENT` | Create team, then spawn manager                             |
| `EXISTS` | Skip create; if manager online `SendMessage`, else re-spawn |

## 2. Determine the active roster (role/language-aware selection)

The team selects by **role + this repo's language**, never spawning all 20. The plugin installs all 20 in the `@` list, but manager only spawns the relevant subset.

```bash
git remote get-url origin   # current repo's remote; extract repo name
```

Call `/route <repo-name>`; read `primary_language` or `modules[].language` and compute the active roster:

| Domain     | Seats                                         | Always-on?                            |
| ---------- | --------------------------------------------- | ------------------------------------- |
| Governance | manager / arbiter / inspector / control-tower | ✅ always                             |
| Quality    | test / reviewer / security                    | ✅ always                             |
| Operations | release / ops                                 | ✅ always                             |
| Data       | data / bi-analyst                             | ✅ always                             |
| Ideation   | business-analyst / product-manager            | ✅ for 0-to-1 features                |
| Design     | architect / ui-ux-designer                    | ✅ for 0-to-1 features                |
| Build      | frontend / backend / edge / station-control   | ⛔ only if the repo has that language |
| Insight    | codebase-analyst                              | on demand                             |

> Build-seat activation by `modules[].language`: `vue`/`typescript`/`javascript`→`frontend`; `java`/`python`→`backend`; `rust`→`edge`; `csharp`→`station-control`. Multi-language repos activate multiple build seats. Empty/meta repos activate none. Mapping table: `manifest.yaml` `task_routing.by_language`.

For 0-to-1 features (not one-off fixes), also activate ideation + design; manager uses `/design` to orchestrate the pipeline.

## 3. Spawn manager

```
Agent(
  name="manager",
  team_name="openindu-maintainers",
  subagent_type="general-purpose",
  description="Manager init: load principles, sync, report ready",
  prompt="<see manager startup prompt>"
)
```

### manager startup prompt

> You are the `openindu-maintainers` team's manager agent. Your full role definition is the plugin agent `openindu-control-tower:manager`.
>
> **Execute in order, no skipping:**
>
> 1. Call `/principle` (RULE 1, mandatory)
> 2. Call `/route` for the openIndu repo panorama
> 3. `git pull origin main`
> 4. `git status`; if dirty, stop and report
> 5. `SendMessage(to="team-lead", summary="Manager ready", message="openIndu Manager ready. Active roster: <the list from step 2>. 11 principles loaded. Awaiting task.")`
>
> **Sub-agent spawn rules (violation = error):**
>
> - Team is flat; teammates can't spawn teammates. **Forbidden**: `name` and `team_name` on spawned sub-agents.
> - Correct: `Agent(description="…", subagent_type="general-purpose", mode="dontAsk", run_in_background=true, prompt="…")`
> - Independent sub-agents must be `run_in_background=true`, parallel; never serial.
> - Same role covering multiple repos with no dependencies → parallel-spawn multiple subagents, each prompt carries `repo="<repo>"`; replicas are spawn params, not agent identity.
>
> **openIndu hard constraints (RULE 7-11)**: no push to main; K8s manifests only in infra-deploy; Gitee PR in English; production SQL needs human approval; after fix run `/delivery-check`.
>
> **Two mandatory STOP points**: ① dispatch plan needs user confirm ② delivery list needs user confirm. No推进 before confirmation.

## 4. With an initial task

`/launch <task description>` appends to the prompt:

> After init, the user's initial task is: `<task description>`. First spawn arbiter to review task nature, then dispatch per the workflow.

No argument:

> After init, await user task.

## 5. Troubleshooting

| Error                                    | Fix                                |
| ---------------------------------------- | ---------------------------------- |
| `team already exists`                    | normal, skip create, continue      |
| `agent type not found`                   | swap `general-purpose` → `claude`  |
| `Teammates cannot spawn other teammates` | drop `name` and `team_name`, retry |
| manager unresponsive                     | delete team dir, re-`/launch`      |

## 6. Reset team

```bash
rm -rf "$HOME/.claude/teams/openindu-maintainers"
```

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\teams\openindu-maintainers"
```
