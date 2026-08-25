---
name: autopilot
description: "Run the SDLC pipeline at a chosen autonomy tier — L0 human-gated (prod/irreducible), L1 feature-branch semi-auto, L2 staging auto-deploy with auto-rollback, L3 sandbox full-auto. Wraps /design so per-phase STOP points are skipped for L2/L3 and kept for L0/L1. Use when you want the team to run a 0-to-1 idea with minimal intervention."
argument-hint: "<idea> [--tier L3]"
disable-model-invocation: true
---

# /autopilot — Tiered autonomous SDLC

Runs the full pipeline (`/design`) at a chosen **autonomy tier**. The tiers decide which STOP points are kept. This skill does NOT remove RULE 4's human gate for irreversible actions — it scopes _where_ full autonomy is safe (sandbox/new repo) vs where humans stay (prod).

**Call `/principle` first** (RULE 1).

---

## Pre-flight: RULE 2 environment check

Before running the pipeline, verify the dev environment can actually build + test:

```bash
# Check deps installed (Python)
pip show fastapi 2>/dev/null || echo "⚠️ deps not installed; run: pip install -r requirements.txt"

# Check docker stack (if docker-compose exists)
test -f docker-compose.yml && docker compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null | head -3
```

If deps are missing: STOP and tell the user "install deps first (pip install -r requirements.txt / pnpm install / cargo build). The pipeline can't self-verify (RULE 2) without a working build environment." Do NOT proceed to build phases with a broken env.

---

## The four tiers

| Tier   | Scope                                                        | STOP behavior                                                  | Deploy                                                             |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **L0** | production / irreversible (main merge, prod DB, prod deploy) | every phase STOP, human at each gate                           | human                                                              |
| **L1** | feature branch in an existing repo                           | phase STOP at design + delivery; build auto-runs test/review   | PR green → human merges                                            |
| **L2** | staging / pre-prod                                           | skip per-phase STOP; one STOP at staging deploy                | merge → GitOps auto-sync to staging + auto-rollback on health fail |
| **L3** | sandbox / new / experimental repo                            | skip ALL per-phase STOP; one final STOP at "done" notification | auto-deploy to sandbox; never touches prod                         |

> RULE 4 is never suspended. L0/L1 actions that are L2+ risk (e.g. a prod DB write mid-pipeline) still require human approval regardless of tier. The tier gates the _workflow STOPs_, not the _risk tiers_ of individual actions.

## 1. Classify the request + pick a tier

```
/autopilot <idea>              # default: L1 (feature-branch, semi-auto)
/autopilot <idea> --tier L3    # sandbox, full-auto
```

Tier selection rules (auto-pick if not specified):

| Signal                                        | Default tier             |
| --------------------------------------------- | ------------------------ |
| new repo, no prod, "experiment" / "prototype" | L3                       |
| existing repo, feature branch, non-prod       | L1                       |
| touches prod config / prod DB / main          | L0 (force; refuse lower) |
| staging / pre-prod deploy                     | L2                       |

If the request says "prod" or targets an irreversible action and the user asked L2/L3 → **downgrade to L0** and state why.

## 2. Hand to /design with the tier context

`/design` runs Phase 0 (codebase-analyst pre-check) first — scanning the target repo for existing implementations before any design work. The autopilot tier controls the STOP policy for Phase 0 too (L0/L1 STOP to confirm scope; L2/L3 auto-adjust).

Pass the tier to `/design` as the STOP policy:

```
/design <idea> --autopilot-tier <L0|L1|L2|L3>
```

`/design` then:

- **L0**: every phase STOP (unchanged behavior).
- **L1**: STOP at phase 1 (business/product alignment) + final delivery; build/test/review auto-run between.
- **L2**: one STOP at "staging deploy candidate ready"; then merge → GitOps auto-syncs to staging with auto-rollback on health-check failure.
- **L3**: no per-phase STOP; the whole pipeline runs; one final STOP/notification at "sandbox deployed".

## 3. Guardrails that NEVER drop, regardless of tier

- **RULE 7** (no push to main): always. Autonomy happens on feature branches; main is always a human-reviewed merge.
- **RULE 4** (L3 risk actions — prod deploy, prod DB write, payment,对外承诺, permission change): always human + dual approval + rollback. Autopilot tier does not override this.
- **RULE 8** (K8s in gitops repo): always. L2 staging deploy = merge to gitops → auto-sync; L3 sandbox deploy uses a sandbox cluster, never prod.
- **RULE 10** (production SQL): always human. Even at L3, a prod DB write is forked out to `data` + human.
- **Credentials**: never in prompts/logs (RULE 5.4).

## 4. Self-verify loop (every tier)

Each phase's build agent must self-verify before handoff: **write → self-test → self-review → verify**. At L0/L1 manager's quality gate re-checks; at L2/L3 the self-verify IS the gate (no human between phases). If self-verify fails twice → escalate to human regardless of tier (auto-downgrade that phase to L0).

## 5. Observability feedback (L2/L3)

After deploy (staging/sandbox), `bi-analyst` + `ops` monitor for a defined window. On metric regression or health-check failure:

- L2: auto-rollback (GitOps revert) + create an issue for `manager`.
- L3: auto-rollback to last green + notify; do NOT auto-retry without a fix.

This closes the loop: idea → build → deploy → monitor → (regression → rollback → issue → re-dispatch).

## 6. Failure handling

| Failure                              | L0/L1                       | L2/L3                                             |
| ------------------------------------ | --------------------------- | ------------------------------------------------- |
| Self-verify fails                    | return to the agent (max 2) | same; after 2, downgrade that phase to L0 (human) |
| Build/CI fails                       | return to fix               | same                                              |
| Deploy health fails                  | human                       | auto-rollback + issue                             |
| Risk action encountered mid-pipeline | STOP, human (RULE 4)        | same — tier never overrides RULE 4                |

## Boundary

`/autopilot` wraps `/design` with a STOP policy + guardrails. It does not replace `/launch` (team startup) — run `/launch` first, then `/autopilot` for the workflow.
