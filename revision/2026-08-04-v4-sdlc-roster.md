---
date: 2026-08-04
slug: v4-sdlc-roster
type: agent
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# v4.0.0: 20-seat SDLC role pipeline + agent-facing English

## Summary

Expands the roster from v3's 4 delivery seats to a full 0-to-1 SDLC role pipeline (20 seats), adds a `/design` orchestration skill, English-ifies all agent-facing assets (agents + principle + skills), and slims team/communications. Reverses v3's "delivery-only" focus: the brain now carries the whole pipeline from business analysis to BI.

## The 20 seats

| Domain     | Seats                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| Governance | manager, arbiter, inspector, control-tower                             |
| Ideation   | business-analyst, product-manager (renamed from `product` + thickened) |
| Design     | architect, ui-ux-designer                                              |
| Build      | frontend, backend, edge, station-control                               |
| Quality    | test, reviewer, security                                               |
| Data       | data, bi-analyst                                                       |
| Operations | ops, release                                                           |
| Insight    | codebase-analyst (NEW, wired to /codebase-analysis skill)              |

Pipeline: `business-analyst → product-manager → architect → ui-ux-designer → build → ops → bi-analyst` (codebase-analyst read-only at any stage; governance/quality cross-cut).

## Design decisions

| Decision                               | Rationale                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full SDLC pipeline (not just delivery) | The repo's purpose is to start agent teams for 0-to-1 work; delivery-only misses ideation/design/ops/BI                                                     |
| `design/<domain>/` workflow per role   | Each role owns a design subdomain in the PROJECT repo (not the brain); agents stay zero-business-binding. Inspired by openIndu-platform's design/ structure |
| New `/design` skill                    | Orchestrates SDLC phase handoff with STOP points; manager runs it for 0-to-1 features                                                                       |
| New `codebase-analyst` agent           | Wires the /codebase-analysis skill to a dedicated insight role (Q3)                                                                                         |
| Agent-facing English                   | Agents/principle/skills in English (token-efficiency, unambiguity, intl.); specs/revisions stay Chinese (history)                                           |
| `design_dir` frontmatter field         | Roles that own a design subdomain declare it; check-roster validates presence for ideation/design roles                                                     |
| team/communications slimmed            | Removed historical thread sample; kept .gitkeep + TASK_LOG template (Q1)                                                                                    |

## English scope (partial)

- English: 20 agents + principle + skills + manifest + CLAUDE + README (EN) + plugin README + team README + check-roster
- Chinese (kept): spec/ + revision/ (historical records) + README_ZH (Chinese counterpart)

## Files

- New agents (7): business-analyst, product-manager, architect, ui-ux-designer, ops, bi-analyst, codebase-analyst
- Rewritten (13): manager, arbiter, inspector, control-tower, frontend, backend, edge, station-control, test, reviewer, security, data, release (English + thickened to ~150-200 lines)
- New skill: /design (SDLC orchestration)
- Principle + launch + adopt + plugin README + CLAUDE + README + README_ZH + team README: English + 20 seats
- manifest: 20 agents + roster + routing + design_dir + SDLC escalation
- check-roster: v4 role set + design_dir validation + 14/16 count ban + business-leak guard (kept)
- plugin.json/marketplace.json: 4.0.0 + "20 maintainer agents"
- team/communications: slimmed (Q1)

## Verification

- [x] prettier --check (3.9.6)
- [x] sync-route --check / detect-modules --check
- [x] check-roster (20 seats + role/design_dir + business-leak guard)
- [x] claude plugin validate --strict (plugin + marketplace)
- [ ] 20 agents' actual invocation + /launch + /design — needs session restart to verify

## Impact

| Scope      | Note                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Downstream | major 3.0.0→4.0.0; old `product` name → `product-manager`; 7 new agents appear in @ list                                                           |
| platform   | platform's 9 L3 local agents now overlap heavily with public v4 roles → spec/002 §8 上收 becomes high-value (the public layer now has equivalents) |
| Rollback   | git revert; downstream can /plugin install @2.2.0 (or @3.0.0)                                                                                      |
