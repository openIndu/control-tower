---
spec_id: NNN-brief-slug
title: <短标题>
status: draft # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: YYYY-MM-DD
updated: YYYY-MM-DD
supersedes: <旧 spec id 或留空>
related_repos:
  - openIndu-backend # 列出影响范围
  - openIndu-admin
implementing_agents:
  - backend # 列出最终落地的 repo agent
  - frontend
related_rules:
  - RULE 7 # 列出强相关的 principle.md 守则
---

# <标题>

## 1. 背景（WHY）

> 为什么需要这个变更？现状是什么？痛点 / 触发事件是什么？

## 2. 设计要点（WHAT）

> 这次变更具体做什么？列出核心改动点（3-7 条）。

- 改动点 1
- 改动点 2
- ...

## 3. 影响范围

| 仓库             | 影响文件 / 模块           | 由谁落地           |
| ---------------- | ------------------------- | ------------------ |
| openIndu-backend | `app/api/...`             | backend agent      |
| openIndu-admin   | `src/...`                 | frontend agent     |
| infra-deploy     | `openIndu-website/*.yaml` | infra-deploy agent |

## 4. 实施路径（HOW）

> 分阶段实施。每阶段必须明确：起点 / 终点 / 验收条件 / 回滚方法。

### 阶段 1 — XXX

- 起点：
- 改动：
- 验收：
- 回滚：

### 阶段 2 — XXX

...

## 5. 回滚方案

> 整个 spec 如果失败如何回滚？需要保留多久？

## 6. 验收标准

| #   | 标准 | 验证方式 |
| --- | ---- | -------- |
| 1   |      |          |
| 2   |      |          |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                    |
| ----------------------- | --------------------------- |
| 守则遵守（11 条任一条） | ✅ / ❌（含具体冲突点）     |
| 跨仓契约对齐            | ✅ / ❌                     |
| 与已定稿 spec 冲突检查  | ✅ / ❌（列出相关 spec id） |
| 最小改动                | ✅ / ❌                     |
| 回滚路径                | ✅ / ❌                     |

## 8. 待解决问题

> 列出已知的开放问题、未拍板的设计决策。如果有，应该在 arbiter 审核前澄清。

- [ ] 问题 1
- [ ] 问题 2

## 9. 变更记录

| 日期       | 变更内容 | 关联 revision |
| ---------- | -------- | ------------- |
| YYYY-MM-DD | 初始草稿 | —             |
