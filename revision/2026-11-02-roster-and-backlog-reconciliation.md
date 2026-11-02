---
date: 2026-11-02
slug: roster-and-backlog-reconciliation
type: other
related_spec: 007-roster-and-backlog-reconciliation
author: control-tower
pr: openIndu/control-tower#TBD
---

# spec 文件夹自查：协调 003 编制结论、收口 001/002 待办、回填 revision 索引

## 变更摘要

一次对 `spec/` 全目录的审计（用户要求）发现 `spec/003-agent-org-design.md` 正文（"16 席"）、自己的最后一条变更记录（"16→14"）与当前现实（20 个 agent，`agents/*.md` 的 `role:` frontmatter 核实）三者互相矛盾——真正的落地记录是 `revision/2026-08-04-v4-sdlc-roster.md`/`v5-autonomy.md`，但两者从未走 spec 的 arbiter 审核流程，003 也从未被标记 `superseded`。同一次审计还发现 001、002 各有一条待解决问题已被现实解决但未收口，以及本目录自己的索引表严重滞后。新增 `spec/007-roster-and-backlog-reconciliation.md` 协调前两者；本次改动顺带回填本索引。

## 涉及文件

| 文件                                            | 改动类型 | 说明                                                                 |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `spec/007-roster-and-backlog-reconciliation.md` | 新增     | 20 席权威快照 + 收口 001/002 的 2 条待办                             |
| `spec/003-agent-org-design.md`                  | 修改     | 仅 `status`（→`superseded`）/`updated` frontmatter + 标题下 1 行指针 |
| `spec/README.md`                                | 修改     | 索引表：003 状态列 → `superseded`；新增 007 一行                     |
| `revision/README.md`                            | 修改     | 索引表从 1 行回填到 81 行（全部既有 revision 文件）                  |

## 触发原因

用户在本次对话中要求"综合评估 spec 文件夹，看看是否需要优化"，审计发现上述 3 项问题后用户明确批复"请直接全部做"。

## 影响评估

| 影响范围               | 说明                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| 哪些 repo agent 受影响 | 无——不改变任何 agent 定义、行为或插件分发内容                            |
| 是否需要下游同步       | 否                                                                       |
| 回滚方法               | `git revert` 本 PR；003 的 `status` 随之恢复 `finalized`，索引表一并复原 |

## 验证记录

- [x] 修改后 `prettier --check` 通过
- [ ] arbiter 审核通过——本次未走独立 arbiter 轮次，用户直接批准（见 spec/007 §9）
- [x] 下游 repo 已同步——不适用，无跨仓影响
