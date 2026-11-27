---
spec_id: 015-issue-verify-loop
title: Lightweight issue → develop → cross-session verify loop
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
  - RULE 7
---

# Lightweight issue → develop → cross-session verify loop

## 1. 背景（WHY）

The three segments of the org's most common development loop exist separately:

- **collect**: `skills/issue-pipeline/scripts/collect-org-issues.mjs` (PR #20,
  spec/005 stage 4) — pulls one repository's open Issues with pagination and
  completeness flags;
- **develop**: `/dev_issue` (heavy machinery: leases, checkpoints, stage
  contracts) or the lighter per-fix pattern a maintainer runs by hand
  (branch from origin/main, red-green tests, local gates, PR);
- **verify**: `/session-verify` (spec/014, PR #121) — independent cross-session
  re-inspection with veto power.

Nothing chains them. A maintainer running the loop by hand (validated on the
2026-11-23/24 openindu-website batch: seven issues from intake to merged,
verified and released across two sessions) must remember the sequencing, the
dispatch discipline, and the receipt format every time. This spec adds the
lightweight orchestration skill `/issue-verify-loop` so the chain is one
command — deliberately NOT extending `/dev_issue`'s heavy machinery, whose
lease/checkpoint contracts don't fit a same-session lightweight loop.

## 2. 设计要点（WHAT）

1. New skill `/issue-verify-loop <openIndu/repo> [--issue <n>] [--max <count>]`:
   collect open Issues for one repository → triage/select → per-issue
   develop → dispatch `/session-verify` per fix → green PRs with
   re-inspection receipts.
2. **Collect** reuses the PR #20 engine (`collect-org-issues.mjs --repo`,
   completeness flag required) — no new collection code.
3. **Selection**: the collected list is presented for owner selection, or
   `--issue <n>` pins one; `--max` caps the batch (default 3 — the 2026-11-23
   batch ran seven and the rework tail was the cost).
4. **Develop** follows the lightweight per-fix pattern (branch from
   origin/main per issue, red-green tests written first, local gates with
   test-count accounting, commit via message-file template). Issues that
   resolve to data-landing SQL or pure infra-deploy changes route to the
   production-safety template / infra-deploy flow instead of code.
5. **Verify** delegates each fix to `/session-verify` (independence, brief,
   findings routing are that skill's contract — this loop only sequences and
   relays). Findings loop back to rework; clean verdicts proceed to PR.
6. **Receipts**: each issue gets a PR + a re-inspection receipt comment; the
   batch ends with a per-issue status summary (merged / awaiting review /
   rework) — never a blanket "all done".

## 3. 影响范围

| 仓库          | 影响文件 / 模块                                                            | 由谁落地      |
| ------------- | -------------------------------------------------------------------------- | ------------- |
| control-tower | `plugins/openindu-control-tower/skills/issue-verify-loop/SKILL.md`（新增） | control-tower |
| control-tower | `spec/015-*.md` + spec 索引；生成的 Codex 发现元数据                       | control-tower |

## 4. 实施路径（HOW）

### 阶段 1 — Draft 与 arbiter 复审

- 起点：**stacked on #121**（feat/spec-015-issue-verify-loop 基于 #121 合并后的 main；spec/014 与本 spec 分属两个 PR，015 依赖 014 的 /session-verify 契约）。
- 改动：spec-015 + SKILL.md；插件校验（check-workflow-docs / check-version-bump / check-pr-scope）。
- 验收：arbiter 复审通过；校验全绿。
- 回滚：关闭 PR；两个 spec 均为 draft，无分发影响（随 014 的版本 bump 一并回退）。

### 阶段 2 — 定稿与分发

- 起点：arbiter 通过；014/015 置 finalized。
- 改动：索引更新、版本发布、生成元数据刷新。
- 验收：下游 `/plugin update` 后 `/issue-verify-loop` 可用。
- 回滚：回滚治理 PR 并再发一版。

### 阶段 3 — 首次实战采用

- 起点：任一仓库的开放 issue 批次。
- 改动：跑一轮 loop（collect → develop → verify → receipts）。
- 验收：每 issue 的 PR 带复检回执；批量收尾有状态汇总。
- 回滚：不适用（运行时流程）。

## 5. 回滚计划

The skill is additive — reverting the PR removes it. No engine, rules, or
downstream changes. A mid-loop interruption leaves at most local branches and
unmerged PRs, each independently revertible.

## 6. 验收标准

| #   | Criterion                                                                           | Executable verification                                                         |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Collect reuses the PR #20 engine (no new collection code)                           | SKILL.md references `collect-org-issues.mjs --repo`; no duplicated collection   |
| 2   | Per-fix verify delegates to /session-verify (no duplicated dispatch logic)          | SKILL.md verify stage references the session-verify contract, not its internals |
| 3   | Selection, batch cap, and per-issue status summary documented                       | SKILL.md sections                                                               |
| 4   | Lightweight boundary explicit (no leases/checkpoints; heavy machinery = /dev_issue) | SKILL.md boundary section                                                       |
| 5   | First real adoption recorded (a loop run with receipts on a PR/issue)               | A linked comment referencing /issue-verify-loop                                 |
