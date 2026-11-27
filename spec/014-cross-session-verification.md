---
spec_id: 014-cross-session-verification
title: Cross-session independent verification dispatch for completed development
status: draft
author: control-tower
created: 2026-11-27
updated: 2026-11-27
supersedes:
related_repos:
  - control-tower
implementing_agents:
  - control-tower
related_rules:
  - RULE 4
  - RULE 5
  - RULE 6
---

# Cross-session independent verification dispatch for completed development

## 1. 背景（WHY）

RULE 5.2 requires every change to pass review, and spec/013 fixed the solo-maintainer
context: an independent agent review **has veto power but never replaces human
approval**. What was missing is a repeatable dispatch discipline: after a development
session claims a change is complete, who re-verifies it, against what checklist, and
through which independent context?

The 2026-11-23/24 openindu-website batch (seven issues closed in one arc) validated
the pattern end-to-end: the development session handed a structured re-inspection
brief to a second Claude session, which independently re-derived the verification —
re-running the red check against the parent commit via a disposable worktree,
re-deriving the four-lens correctness review, reconciling an evidence conflict with
an authoritative full-corpus walk (156,499 Milvus rows), and catching a mis-attribution
and a load-bearing unverified assumption the dev session had not flagged. Findings went
back to the dev session for rework or to the owner for approval; the shared checkout
stayed untouched (worktree isolation).

Two failure modes motivated formalizing it: (a) self-reported verification is not
evidence — the dev session's own claims were correct this time, but the discipline is
what makes that trustworthy; (b) without a brief template, an ad-hoc reviewer re-derives
less than it should (the evidence-conflict case surfaced only because the brief demanded
the load-bearing assumption be checked against production data).

## 2. 设计要点（WHAT）

1. New skill `/session-verify <repo> <merge-commit-or-PR-ref> [issue-number]`
   (narrow scope — composable after `/dev_issue` or any manual development):
   dispatches an independent re-inspection of a just-completed change.
2. **Dispatch independence rule**: the verifying context must never be the author
   session. Preference order: a peer Claude session on the same machine
   (`ListAgents`, pick an idle one, dispatch via SendMessage with the brief);
   fallback: spawn the `reviewer` agent. The peer-session route gives true
   independent context; the agent fallback works on any machine.
3. **Brief template** (the skill generates it from the actual change):
   - red-green honesty: re-derive from the parent commit (worktree isolation —
     the verifying session must not mutate the shared checkout);
   - correctness four lenses (RULE 5.2): correctness / security /
     maintainability / architectural consistency;
   - scope: `git show <merge> --stat` — exactly the declared files, nothing else;
   - acceptance coverage: issue acceptance items mapped to dev-side done vs
     owner-side pending;
   - explicit instruction: do not trust the dev session's self-description —
     everything re-derived from code and live execution.
4. **Findings format**: per-lens sections, each finding with
   `[severity: critical/major/minor/observation]` + evidence; a final verdict
   stating 修复是否成立 / 测试是否可信 / 有无返工点.
5. **Routing of findings**: critical/major → rework loop by the dev session;
   clean → the human approval gate (RULE 5.2) proceeds. Agent findings have
   veto power; they never satisfy or replace human review (spec/013 boundary).
6. **Record**: the verdict is posted to the PR/issue as the re-inspection
   receipt; retrieval-type changes record findings in three categories
   (命中 / 显式报错 / 识别通过但空结果) so corpus or caliber work items become
   explicit tickets.

## 3. 影响范围

| 仓库        | 影响文件 / 模块                                                        | 由谁落地       |
| ----------- | ---------------------------------------------------------------------- | -------------- |
| control-tower | `plugins/openindu-control-tower/skills/session-verify/SKILL.md`（新增） | control-tower  |
| control-tower | `spec/014-*.md` + spec 索引；生成的 Codex 发现元数据；插件版本 minor+1  | control-tower  |

## 4. 实施路径（HOW）

### 阶段 1 — Draft 与 arbiter 复审

- 起点：control-tower main 干净；spec-014 draft + SKILL.md 同 PR。
- 改动：提交 spec 与 skill；跑插件校验（check-version-bump / sync-codex-skills / 格式检查）；版本 minor+1。
- 验收：arbiter 复审通过（不超过三轮）；插件校验全绿。
- 回滚：关闭 PR，删除未定稿分支；无分发内容变化。

### 阶段 2 — 定稿与分发

- 起点：arbiter 通过记录在案。
- 改动：spec 置 finalized、索引更新、版本号发布、生成元数据刷新。
- 验收：下游 `/plugin update` 后 `/session-verify` 可用。
- 回滚：回滚治理 PR 并再发一版；旧插件继续可用旧流程。

### 阶段 3 — 首次实战采用

- 起点：任意已声称完成的开发变更。
- 改动：按 skill 流程派发一次复检并回执。
- 验收：brief/发现/路由三件齐全，共享检出零接触。
- 回滚：不适用（运行时流程，无仓库变更）。

## 5. 回滚计划

The skill is additive — reverting its PR and republishing the plugin version
removes it. No runtime behavior, rules text, or downstream repos change. A
mid-verification dispatch is a conversation; there is nothing to roll back.

## 6. 验收标准

| #   | Criterion                                                                                                    | Executable verification                                                            |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Skill exists, registers in Claude (`/session-verify`) and Codex discovery                                     | `sync-codex-skills.mjs` reports 26 == canonical; `claude mcp`-style listing shows the command |
| 2   | Dispatch independence enforced by the brief (author session excluded, worktree isolation, read-only)          | Brief text contains the independence rule; the skill refuses to dispatch to the author session |
| 3   | Brief template covers red-green re-derivation, four lenses, scope stat, acceptance coverage                   | SKILL.md checklist matches this spec's design points                               |
| 4   | Findings format + routing (veto / rework / human gate) documented                                             | SKILL.md routing section                                                           |
| 5   | First real adoption recorded (brief + findings + verdict on a PR/issue)                                       | A linked PR/issue comment referencing `/session-verify`                            |
