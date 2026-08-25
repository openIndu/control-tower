# Revision — 修订记录（changelog）

本目录是 openIndu 社区管控层资产变更的 changelog（**HOW + WHEN**），与 [`../spec/`](../spec/) 一一对应：

- `spec/` 描述设计与决策（WHAT + WHY）
- `revision/` 描述每次实际修订（HOW + WHEN）

## 命名约定

```
YYYY-MM-DD-brief-slug.md
```

示例：

```
2026-06-25-init-openindu-control-tower.md
2026-07-15-add-rule12-data-retention.md
```

## 什么内容值得记 revision

| 类型                                    | 是否需要 revision               |
| --------------------------------------- | ------------------------------- |
| `principle.md` 任一条 RULE 变更         | **必须**                        |
| 新增 / 修改 / 删除 agent                | **必须**                        |
| `route.json` 仓库新增 / 迁移            | **必须**                        |
| `manifest.yaml` 升级规则 / 任务路由变更 | **必须**                        |
| spec 定稿                               | 自动（spec 状态变更不必单独记） |
| spec 修订（revision_required 退回）     | 否（spec 内变更记录字段记）     |
| agent 行为约束新增 / 调整               | **必须**                        |
| 文档错别字 / 格式                       | 否                              |

## 工作流

```
control-tower / 其他 agent 完成一次资产修订
        │
        ▼
按 TEMPLATE.md 写入 revision/YYYY-MM-DD-brief-slug.md
   · 描述改了什么、为什么改、对应 spec id（如有）
        │
        ▼
连同代码一起 commit（同一个 PR 中）
        │
        ▼
PR 标题 / 正文引用 revision slug
```

## 索引

| 日期       | 标题                                             | 关联 spec |
| ---------- | ------------------------------------------------ | --------- |
| 2026-06-25 | init: openIndu workflow-control-tower 仓库初始化 | —         |
