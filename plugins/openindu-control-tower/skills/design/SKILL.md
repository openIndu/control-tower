---
name: design
description: Orchestrate the 0-to-1 SDLC pipeline across the role agents. Hands off along business-analyst → product-manager → architect → ui-ux-designer → build (backend/frontend/edge/station-control) → ops → bi-analyst, with each phase writing its design/&lt;domain&gt;/ artifact and the next phase reading it. Use when a feature needs the full design pipeline (not a one-off fix).
argument-hint: "[feature description]"
disable-model-invocation: true
---

# /design — SDLC pipeline orchestration

Drives a 0-to-1 feature through the SDLC role pipeline. Each phase's role writes its `design/<domain>/` artifact; the next phase reads it. STOP points at every phase handoff by default; `/autopilot` can relax them per tier.

**Call `/principle` first** (RULE 1).

---

## Autopilot mode

If invoked via `/autopilot <idea> --tier L<n>`, the STOP policy changes by tier:

- **L0** (prod/irreducible): every phase STOP (default behavior).
- **L1** (feature branch): STOP at phase 1 + final delivery; build/test/review auto-run between.
- **L2** (staging): one STOP at "staging deploy candidate"; merge → GitOps auto-sync + auto-rollback.
- **L3** (sandbox): no per-phase STOP; one final notification at "sandbox deployed".

RULE 4 (L3 risk actions), RULE 7 (no push to main), RULE 8 (K8s in gitops), RULE 10 (prod SQL) are **never** suspended by any tier. See `/autopilot`.

---

## 0. Codebase pre-check (before any design)

**Invoke `codebase-analyst` BEFORE the ideation/design phases** to scan the target repo for existing implementations of the requested feature. This prevents "designing something that already exists" (pilot finding #1 from openIndu-website 2026-08-05).

| What codebase-analyst does                                                                     | Output                             |
| ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| Scans the target repo (via `/route`) for existing endpoints/files/modules matching the feature | `design/insight/<feature>-scan.md` |

| Result                            | Pipeline adjustment                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Found existing implementation** | Switch from 0-to-1 to **enhancement flow** (step 1, row 2). The business-analyst/product-manager/architect phases work on the DELTA (what's missing from the existing implementation), not a greenfield design. |
| **Found partial implementation**  | Scope = fill the gap. Architect reads the existing code's patterns + conventions (response format, router style, etc.) before proposing changes.                                                                |
| **Not found**                     | Proceed with the normal 0-to-1 pipeline.                                                                                                                                                                        |

🛑 **STOP at L0/L1**: show the pre-check result to the user; confirm scope (enhance vs new build) before proceeding. At L2/L3: auto-adjust scope, note in thread, proceed.

---

## The pipeline

```
codebase-analyst            → design/insight/<feature>-scan.md (Phase 0: pre-check)
        │ (scope: enhance existing or new build?)
        ▼
business-analyst          → design/business/business-analysis-report.md
        │ (handoff)
        ▼
product-manager           → design/product/prd/<feature>-prd.md
        │
        ▼
architect                 → design/architecture/ (+ ADRs)
        │
        ▼
ui-ux-designer            → design/uiux/<screen>-ui.md
        │
        ▼
build (backend/frontend/edge/station-control)
                          → code + design/database/ (backend owns DB design)
        │
        ▼
ops                       → design/ops/runbooks/ + topology
        │
        ▼
bi-analyst                 → design/bi/metrics-registry.md + dashboard spec
```

`codebase-analyst` can be invoked at **any** phase for read-only insight on unfamiliar code (it never edits).

## 1. Classify the request

| Request type                    | Flow                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| 0-to-1 feature (new capability) | Phase 0 pre-check → if not found, full pipeline                          |
| Enhancement to existing feature | Phase 0 pre-check → product-manager → architect (delta) → build → ops/bi |
| One-off fix                     | Skip /design; go straight to the build role + /delivery-check            |
| Research / "should we build X"  | Stop at business-analyst; don't proceed to build without a decision      |

If the request is vague, STOP and clarify with the user before starting.

## 2. Run each phase (with STOP points)

For each phase:

1. `manager` spawns the role agent (background, `repo=` param).
2. The role agent:
   - calls `/principle`
   - calls `/route`
   - reads its own role memory (`/memory`, `team/communications/memory/<role>/`)
   - reads the prior phase's `design/<domain>/` output
   - writes its own `design/<domain>/` artifact
   - **self-verifies** (build roles: build → self-test → self-review → verify) before reporting done
   - writes a completion_report to `team/communications/threads/{task-id}/`
3. 🛑 **STOP** — show the artifact to the user; confirm before the next phase.

```
For feature: <description>
  □ Phase 0: codebase-analyst → design/insight/<feature>-scan.md      [🛑 confirm scope]
  □ Phase 1: business-analyst → design/business/business-analysis-report.md   [🛑 confirm]
  □ Phase 2: product-manager → design/product/prd/<feature>-prd.md            [🛑 confirm]
  □ Phase 3: architect → design/architecture/ + ADRs                         [🛑 confirm]
  □ Phase 4: ui-ux-designer → design/uiux/<screen>-ui.md                     [🛑 confirm]
  □ Phase 5: build roles → code + design/database/                           [🛑 confirm]
  □ Phase 6: ops → design/ops/                                              [🛑 confirm]
  □ Phase 7: bi-analyst → design/bi/                                        [🛑 confirm]
  □ /delivery-check — RULE 11 completeness                                   [🛑 confirm]
```

## 3. Phase skip rules

- Skip a phase ONLY when its input doesn't exist yet (e.g. skip ui-ux-designer for a pure backend/API feature — note the skip in the thread).
- Never skip business-analyst + product-manager for a 0-to-1 feature — that's the whole point.
- architect can be a delta review for enhancements (read existing architecture, produce only the delta ADR).

## 4. Handoff contract

Each phase's artifact is the next phase's input. If a phase can't proceed (ambiguous input), it STOPS and requests the prior phase revise — don't guess forward. Max 2 revision rounds, then escalate to `manager`.

## 5. Completion

Pipeline done = all phase artifacts exist + build produces working code + `/delivery-check` shows RULE 11 completeness. Present the full `design/` tree + change list + delivery checklist to the user.

## Boundary

`/design` orchestrates; it does not write artifacts itself (the role agents do). It does not replace `/launch` (which spawns manager + activates the roster) — `/design` is the workflow manager runs once the team is up.

## Two-repo PR flow (submodule architecture)

When the target repo is a **submodule** of an aggregate repo (e.g. `openIndu-backend` under `openIndu-website`):

- **Design docs** commit to the **aggregate** repo (e.g. `openIndu-website/design/`).
- **Code changes** commit to the **submodule** repo (e.g. `openIndu-backend/`) → submodule PR.
- After the submodule PR merges, the **aggregate** repo needs a submodule pointer update PR (RULE 11 step ③).
- Two PRs total (submodule code + aggregate pointer) — this is inherent to the submodule architecture, not a bug. `manager` coordinates both.
