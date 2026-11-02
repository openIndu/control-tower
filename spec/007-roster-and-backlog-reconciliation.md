---
spec_id: 007-roster-and-backlog-reconciliation
title: 协调 spec 001/002/003 的过时结论——定稿现行 20 席编制，标记 003 为 superseded
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-11-02
updated: 2026-11-02
supersedes: 003-agent-org-design
related_repos:
  - control-tower
implementing_agents:
  - control-tower
related_rules:
  - RULE 1
  - RULE 6
---

# 协调 spec 001/002/003 的过时结论——定稿现行 20 席编制，标记 003 为 superseded

## 1. 背景（WHY）

一次对 `spec/` 全目录的自查（2026-11-02，用户要求"综合评估 spec 文件夹，看看是否需要优化"）发现三份已定稿 spec 的内容与当前实际状态不一致：

**`spec/003-agent-org-design.md` 自相矛盾，且与现状不符。** 该文件 §2.3「编制总览」正文明确写着"**16 席** = 栈无关 10 + 语言 6"（第 249-266 行），但同一文件最后一条变更记录（第 394 行，2026-08-04）写的是"反转 §2.1 的 6 语言席决策：6 语言席→4 职位席（**16→14**）"——结论已经翻转，正文从未跟着改。而当前真实状态是 **20 个 agent**（见 §2 下方的核实命令），三个数字互相矛盾。

真正的落地记录在 `revision/2026-08-04-v4-sdlc-roster.md`（14→20，加入完整 ideation/design/insight 域，原话"Reverses v3's delivery-only focus"）与 `revision/2026-08-04-v5-autonomy.md`（分层自主权 + `/autopilot`/`/memory`/`/design-md`）。两份都把 `related_spec` 填成 `003-agent-org-design`，但这是事后挂靠，不是 003 走过"control-tower 起草 → arbiter 审核 → finalized"的结论——与 001、002、004、005、006 每一次实质调整都留有完整审核记录的做法不一致。`spec/README.md` 定义的 `superseded` 状态值，6 份 spec 里至今一次都没用过。

**`spec/001-shared-plugin-distribution.md` 与 `spec/002-agent-consolidation.md` 各有一条待解决问题已被现实解决但未收口**：

- 001 第 151 行："`route.json` 中 `aggregate` 字段的语义矛盾如何修正（阶段 3）"——当前 `route.json` 核实，`openindu-studio`/`openindu-platform` 条目已不再错误携带 `aggregate` 字段，矛盾已不存在。
- 002 第 180 行："`openIndu-studio`/`openIndu-controller`/`openindu-vision` 三个仓完全没有 agent——是不需要，还是没来得及建？"——现由 build 域的 4 个职位 agent（`frontend`/`backend`/`edge`/`station-control`）按模块路由覆盖，不是「每仓建专属 agent」的思路，但问题本身已经有了明确答案。

RULE 6 规定已定稿 spec 不可直接编辑，所以 001、002、003 三个文件本身都不动；本 spec 是面向未来读者的权威协调记录。

**不在本 spec 范围内**：同一次自查还发现 `revision/README.md` 的索引表严重滞后（81 个 revision 文件只登记了 1 条，自第二个文件起从未回填）。这纯粹是机械的目录维护，不是"调整已定稿 spec 的结论"，revision/README.md 自己的工作流也把索引当作持续追加的活页，不受 RULE 6 约束，因此已在同一次改动中直接回填，不走 spec 流程。

**流程说明**：本次改动是对已经实施、合入、运行约 3 个月的 v4/v5 决定做回溯性文档协调，不改变任何运行时行为、agent 定义或插件分发内容。用户在看过完整审计发现后明确说"请直接全部做"——这是本 spec 的直接批准，未经独立的 arbiter 轮次；见 §9。

## 2. 设计要点（WHAT）

- **发布当前权威的 20 席快照**（取代 003 §2.2-§2.3 的编制表，不取代其 §1 的"为什么按能力/语言而非仓库编制"的论证，那部分论证仍然成立）：

  | 域         | 席位（共 20）                              |
  | ---------- | ------------------------------------------ |
  | Governance | manager, arbiter, inspector, control-tower |
  | Ideation   | business-analyst, product-manager          |
  | Design     | architect, ui-ux-designer                  |
  | Build      | frontend, backend, edge, station-control   |
  | Quality    | test, reviewer, security                   |
  | Data       | data, bi-analyst                           |
  | Operations | ops, release                               |
  | Insight    | codebase-analyst                           |

  核实命令（在 control-tower 仓库根目录执行，每个 agent 文件的 `role:` frontmatter 直接读出，不依赖任何文档转述）：

  ```bash
  for f in plugins/openindu-control-tower/agents/*.md; do
    name=$(grep -m1 '^name:' "$f" | sed 's/name: *//')
    role=$(grep -m1 '^role:' "$f" | sed 's/role: *//')
    echo "$role | $name"
  done | sort | wc -l   # 应输出 20
  ```

- **标记 `spec/003-agent-org-design.md` 为 `superseded`**：只编辑其 frontmatter 的 `status` 字段（`finalized` → `superseded`）与 `updated` 日期，并在标题正下方插入一行指针说明"编制表本身"被取代、其余论证不受影响；正文、表格、变更记录逐字不动（RULE 6 第 3 步的字面许可——改状态字段附指针，不是改内容）。
- **收口 001 第 151 行与 002 第 180 行的待解决问题**：不编辑 001.md / 002.md 本身（同受 RULE 6 约束），而是在本 spec 里给出现状核实结果作为权威收口记录（见 §1）。
- **`spec/README.md` 索引表同步**：003 行的状态列改为 `superseded`，新增 007 一行。

## 3. 影响范围

| 仓库          | 影响文件 / 模块                                                                                    | 由谁落地      |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| control-tower | `spec/007-roster-and-backlog-reconciliation.md`（新增，本文件）                                    | control-tower |
| control-tower | `spec/003-agent-org-design.md`（仅 `status`/`updated` frontmatter 字段 + 标题下一行指针）          | control-tower |
| control-tower | `spec/README.md`（索引表：003 状态列、新增 007 一行）                                              | control-tower |
| control-tower | `revision/README.md`（索引回填，81 行，见 §1「不在本 spec 范围内」——机械维护，随本次改动一并提交） | control-tower |
| control-tower | `revision/2026-11-02-roster-and-backlog-reconciliation.md`（新增）                                 | control-tower |
| 其他仓库      | 无文件改动；不涉及插件分发内容，不触发版本号变化                                                   | —             |

## 4. 实施路径（HOW）

单阶段，纯文档协调，无代码或运行时行为变化：

- 起点：spec/003 正文与自己的变更记录、与当前现实三者矛盾；001/002 各 1 条待办已被现实解决但未收口；revision/README.md 索引基本空白。
- 改动：见 §2、§3。
- 验收：见 §6。
- 回滚：`git revert` 本 PR——003 的 `status` 字段随之恢复 `finalized`，revision/README.md 索引恢复原状，007 与新 revision 记录一并消失。无数据或行为副作用。

## 5. 回滚方案

整个改动是 1 个新文件（本 spec）+ 1 个新 revision 记录 + 对 2 个既有文件的最小编辑（003 的 2 个 frontmatter 字段 + 1 行指针；`spec/README.md` 索引表 2 处）+ revision/README.md 的索引回填。`git revert` 单个 PR 即可完全复原，不需要保留任何中间状态。

## 6. 验收标准

| #   | 标准                                                                                                                                | 验证方式                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | 20 席快照与 `agents/*.md` 的 `role` frontmatter 逐一核对一致                                                                        | §2 的 grep 命令，输出 20                                                |
| 2   | `spec/003-agent-org-design.md` 除 frontmatter 的 `status`/`updated` 与标题下新增的 1 行指针外，其余内容字节级不变                   | `git diff origin/main -- spec/003-agent-org-design.md`，确认改动行数 ≤4 |
| 3   | `spec/001-shared-plugin-distribution.md`、`spec/002-agent-consolidation.md` 本身不在改动文件列表里（RULE 6：不直接编辑已定稿 spec） | `git diff --name-only origin/main` 不含这两个路径                       |
| 4   | `spec/README.md` 索引表 003 行状态列显示 `superseded`，新增 007 一行                                                                | 人工核对                                                                |
| 5   | CI 全绿（prettier、`sync-route --check`、`check-roster`、`claude plugin validate --strict`、`check-version-bump`）                  | CI                                                                      |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ✅ 本 spec 本身就是 RULE 6 定义的 supersede 机制第一次被实际使用；RULE 1：不新设规则，只是让"唯一来源"与现状对齐                      |
| 跨仓契约对齐            | ✅ 不涉及任何跨仓契约、route.json 字段或 agent 行为，纯本仓文档                                                                       |
| 与已定稿 spec 冲突检查  | ✅ 这正是本 spec 的目的——消解 003 正文/changelog/现状三者的矛盾；与 001、002、004、005、006 均无新冲突                                |
| 最小改动                | ✅ 新增 1 个 spec 文件 + 1 个 revision 文件；对既有文件的编辑仅 003 的 2 个 frontmatter 字段 + 1 行指针、`spec/README.md` 索引表 2 处 |
| 回滚路径                | ✅ 见 §5：单次 `git revert` 完全复原                                                                                                  |

## 8. 待解决问题

无。

## 9. 变更记录

| 日期       | 变更内容                                                                                                                                                                                                                                                                                              | 关联 revision                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2026-11-02 | 初始草稿，基于用户要求的 `spec/` 文件夹审计直接撰写。本次改动是对已实施并运行约 3 个月的 v4/v5 决定的回溯性文档协调，不改变任何运行时行为、agent 定义或插件分发内容；用户在看过完整审计发现后明确批准"请直接全部做"，作为本 spec 的直接批准，未经独立的 arbiter 轮次。`status` 直接定为 `finalized`。 | 2026-11-02-roster-and-backlog-reconciliation.md |
