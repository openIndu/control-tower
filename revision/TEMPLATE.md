---
date: YYYY-MM-DD
slug: brief-slug
type: principle | agent | route | manifest | other
related_spec: NNN-brief-slug # 关联 spec id，如无填 —
author: <agent 或 用户名>
pr: openIndu/workflow-control-tower#NN # 关联 PR
---

# <短标题>

## 变更摘要

> 一段话说清楚改了什么、为什么改。

## 涉及文件

| 文件                 | 改动类型 (新增/修改/删除) | 说明                 |
| -------------------- | ------------------------- | -------------------- |
| `team/principle.md`  | 修改                      | RULE X 新增第 Y 条款 |
| `team/manifest.yaml` | 修改                      | 新增任务路由规则     |

## 触发原因

> 是什么 spec / inspector 提案 / 用户反馈触发了这次修订？引用具体 thread / issue / PR。

## 影响评估

| 影响范围               | 说明                          |
| ---------------------- | ----------------------------- |
| 哪些 repo agent 受影响 |                               |
| 是否需要下游同步       | 是 / 否（如是，列出同步任务） |
| 回滚方法               |                               |

## 验证记录

- [ ] 修改后 `prettier --check` 通过
- [ ] arbiter 审核通过（如适用）
- [ ] 下游 repo 已同步（如适用）
