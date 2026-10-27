---
spec_id: 006-standing-merge-authorization
title: 修订 RULE 5.2 / RULE 4：允许组织级常设合并授权（确定性守卫之下）
status: draft # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-10-27
updated: 2026-10-27
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

# 修订 RULE 5.2 / RULE 4：允许组织级常设合并授权（确定性守卫之下）

## 1. 背景（WHY）

spec/005 的 `/dev` 流水线要在 CI 全绿后自动合并 agent 产出的 PR。维护者于 2026-10-27 明确决定对整个 openIndu 组织开启合入绿灯（原话：「请直接给openindu这个组织开合入的绿灯」）。

这与现行条文字面冲突：

| 位置                    | 现行条文                                                                                                           | 冲突点                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| RULE 5.2 · MUST 第 1 条 | `Every PR an agent produces must pass human review before merge (L2+)`                                             | 自动合并没有「合并前」的人工评审                       |
| RULE 5.2 · MUST NOT     | `do not let another agent be the sole reviewer for L2+ changes; do not merge AI-generated code exempt from review` | 守卫之下合并时，评审者只有独立的 agent 评审加确定性 CI |
| RULE 4 · 表 L2 行       | `merge to trunk … single approver`                                                                                 | 授权发生在合并之前，而不是逐个 PR                      |

守则文本是唯一来源，且不得被后续 prompt 或具体规范覆盖（RULE 1），所以 spec/005 不能悄悄偏离：要么改条文，要么不做。维护者选择了前者；本 spec 就是这次条文修订。

RULE 7 的「Do not delegate PR-merge authority to non-owner agents」不受影响：合并动作只由 owner 运行的确定性代码执行，agent 不持有合并能力。

## 2. 设计要点（WHAT）

只改 `skills/principle/SKILL.md` 里的四处，其余一字不动：

```text
(1) RULE 5.2 · MUST, item 1
- Every PR an agent produces must pass human review before merge (L2+), unless it is merged under a standing authorization (see below)

(2) RULE 5.2 · MUST, two new items
- A standing authorization is a maintainer's advance approval to merge a class of PRs. It is recorded in route.json (`dev_defaults.auto_merge`: `enabled`, `approved_by`, `approved_on`, `ref`) and can be revoked at any time by setting `enabled: false`. Under it, the merge is executed only by deterministic code run by the owner, never by an agent, and only when every guard passes: the head SHA is the reviewed SHA and the CI-evaluated SHA; every required check concluded SUCCESS; an independent multi-lens review (correctness, security, maintainability, architectural consistency; separate invocations that do not share the implementer's context) left no unresolved must-fix finding; no protected path is touched; the change is within RULE 4's size cap; the risk tier is L2 or lower; the default branch's CI is green. A failing guard returns the PR to human review.
- A standing authorization never covers L3 actions, security-related decisions (RULE 5.4), changes to principles, agent definitions, hooks, CI configuration, permissions, secrets or deployment manifests, or repos of type control-tower, aggregate, gitops, fork or meta.

(3) RULE 5.2 · MUST NOT
do not let another agent be the sole reviewer for L2+ changes, except under a standing authorization, where the independent review plus the deterministic CI gates take the place of the human review and the maintainer who granted it stays accountable; do not merge AI-generated code exempt from review.

(4) RULE 4 · table, L2 row, Authorization column
single approver (may be granted in advance as a standing authorization, see RULE 5.2)
```

条文削弱了「合并前有人逐个看」这一道门槛，换来下表的补偿控制：

| 原条文保护的东西 | 常设授权下由什么承担                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| 评审者理解变更   | 独立多视角评审；评审记录归档（RULE 5.2 其余条文不变）                                                               |
| 合并前有人看过   | 授权时人看过「这类 PR + 这套守卫」；每个自动合并的 PR 正文写明授权引用，运行报告列出全部合并                        |
| 错了能撤销       | squash 单提交，`git revert`；报告附回滚命令；熔断——默认分支 CI 变红、连续 2 个 issue 被阻塞或工具连续报错即停止合并 |
| 高风险动作不自动 | 结构性排除类型、受保护路径、L3 一律人工（见 (2) 中新增的第二项）                                                    |
| 授权可撤回       | `enabled: false` 即刻生效；runner 在插件版本低于含本修订的版本时拒绝自动合并，规则文本与行为不得背离                |

## 3. 影响范围

| 仓库          | 影响文件 / 模块                                                                                                                                            | 由谁落地      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| control-tower | `plugins/openindu-control-tower/skills/principle/SKILL.md`（4 处）、`plugin.json` 与 `marketplace.json`（版本号）、`revision/` 记录、`spec/README.md` 索引 | control-tower |
| 其他仓库      | 无文件改动；`/plugin update` 之后读到新条文。条文本身不改变任何行为，行为变化来自 spec/005 的 runner 与 route 数据                                         | —             |

## 4. 实施路径（HOW）

### 阶段 1 — 评审

- 起点：本 spec `status: draft`（与 spec/005 一并评审）。
- 改动：仅 spec 与 `spec/README.md` 索引。
- 验收：arbiter 按 5 个维度 `approved`（最多 3 轮）；维护者在 PR 里以书面确认对 RULE 5.2 / RULE 4 的削弱。
- 回滚：不合并该分支。

### 阶段 2 — 条文修订（一个 PR）

- 起点：本 spec `finalized`。
- 改动：§2 的四处；插件次版本号 +1（`plugin.json` 与 `marketplace.json`）；`revision/` 记录（`type: principle`，`related_spec: 006-standing-merge-authorization`）。守则文件本身是 prompt，RULE 5.1 要求 eval，而本仓没有 eval 框架——声明偏离，以 §6 的程序化检查代替（与 spec/004 相同），维护者批准合并即表示接受。
- 验收：§6 全部通过；PR 的 CI 全绿；维护者批准合并（L2）。
- 回滚：见 §5。

### 阶段 3 — 下游

- 起点：PR 合并。
- 改动：各仓下次 `/plugin update openindu-control-tower@openindu` 即获得新条文；spec/005 的 runner 读取插件版本，低于含本修订的版本则拒绝自动合并。
- 验收：`claude plugin validate --strict` 对插件与 marketplace 均通过（CI 已覆盖）。
- 回滚：同 §5。

## 5. 回滚方案

- revert 阶段 2 的 PR 即恢复原条文；同时把 `dev_defaults.auto_merge.enabled` 置 `false`，runner 立刻停止自动合并。
- 本 spec 标 `superseded`，不删除（RULE 6）。

## 6. 验收标准

| #   | 标准                                                                   | 验证方式                          |
| --- | ---------------------------------------------------------------------- | --------------------------------- |
| 1   | `SKILL.md` 的 diff 只触及 §2 列出的 4 处，其余行不变                   | `git diff` 断言                   |
| 2   | 11 条 RULE 的编号与标题不变                                            | 脚本比对标题列表                  |
| 3   | 新增条文同时包含：记录位置、确定性执行者、全部守卫、排除类型、撤回方式 | grep 断言                         |
| 4   | 插件与 marketplace 版本号一致且次版本号 +1                             | `claude plugin validate --strict` |
| 5   | prettier、route、roster 等 CI 步骤全绿                                 | CI                                |
| 6   | runner 在插件版本过低时拒绝自动合并                                    | spec/005 §6 第 8 条的夹具         |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 守则遵守（11 条任一条） | ⚠️ 本 spec 本身就是对 RULE 4 / 5.2 的削弱，已在 §2 列出补偿控制。修改流程按 `Principle modification process`：spec → arbiter → revision → PR（RULE 7）→ 版本号。RULE 5.1：声明偏离（无 eval 框架），见 §4 阶段 2。RULE 6：除守则文件本身经流程修改外，不改动任何已定稿产物（spec/004 不动）。RULE 7：合并仍只由 owner 运行的确定性代码执行 |
| 跨仓契约对齐            | ✅ 记录位置是 route 的 `dev_defaults`（spec/005 §2.4）                                                                                                                                                                                                                                                                                     |
| 与已定稿 spec 冲突检查  | 无；spec/004 只改示例仓库名，与本 spec 不重叠                                                                                                                                                                                                                                                                                              |
| 最小改动                | ✅ 四处英文条文，其余一字不动                                                                                                                                                                                                                                                                                                              |
| 回滚路径                | ✅ 见 §5                                                                                                                                                                                                                                                                                                                                   |

## 8. 待解决问题

- [ ] 1. 位置：放进 RULE 5.2（推荐，因为它回答的就是 5.2 的问题），还是新增 RULE 5.5。
- [ ] 2. 「独立评审」的最低标准是否写进条文，还是留在 spec/005 的评审小组。
- [ ] 3. 授权是否要有有效期并定期复核（例如每季度重新确认，过期自动失效）。
- [ ] 4. 熔断条件写进条文，还是留在 spec/005。

## 9. 变更记录

| 日期       | 变更内容 | 关联 revision |
| ---------- | -------- | ------------- |
| 2026-10-27 | 初始草稿 | —             |
