# Spec — 特性与改进设计

本目录存放 openIndu 社区管控层的特性 / 流程改进 / 规范演进的设计文档（**WHAT + WHY**），由 control-tower agent 完成第一轮设计，提交 arbiter 审核后定稿。

> **配套目录**：[`../revision/`](../revision/) 是"做了哪些修订"的 changelog（HOW + WHEN），一一对应可回溯。

## 命名约定

```
NNN-brief-slug.md
```

- `NNN`：三位数字递增（001, 002, …）
- `brief-slug`：短横线连接的英文/拼音 slug，6-8 词内

示例：

```
001-upstream-principle-sync.md
002-frontend-replica-merge.md
003-inspector-weekly-cron.md
```

## 状态字段

每个 spec 在 frontmatter 中标注：

| status              | 含义                                          |
| ------------------- | --------------------------------------------- |
| `draft`             | control-tower 草稿，尚未提交审核              |
| `under_review`      | 已提交 arbiter 审核（threads 中跟踪）         |
| `revision_required` | arbiter 审核退回修订（最多 3 轮）             |
| `finalized`         | 定稿，可派给 repo agent 落地                  |
| `superseded`        | 已被新 spec 取代（保留历史，不删除 — RULE 6） |

## 工作流

```
触发：manager 派任务 / inspector 提案 / control-tower 自主发现
        │
        ▼
control-tower 加载 principle.md + route.json + 现有 spec
        │
        ▼
按 TEMPLATE.md 撰写草稿（status: draft）
        │
        ▼
control-tower 提交 arbiter（threads 中写 review_request）
        │
        ├── approved → status: finalized → manager 派发到 repo agent
        ├── revision_required → control-tower 修订（最多 3 轮）
        └── 3 轮僵持 → 升级 manager
```

## 已定稿 spec 不可修改（RULE 6）

如需调整已 finalized 的 spec：

1. **不要直接编辑该文件**
2. 新写一个 spec，引用旧 spec 并标注 "supersedes NNN-xxx.md"
3. 把旧 spec 的 status 改为 `superseded`，附"被 NNN-new.md 取代于 YYYY-MM-DD"
4. 在 `../revision/` 中记录这次替换

## 索引

| NNN | 标题                                                                                      | 状态      | 责任人        | 创建日     |
| --- | ----------------------------------------------------------------------------------------- | --------- | ------------- | ---------- |
| 001 | [用 Claude Code 插件把守则与治理 agent 下发到全组织](./001-shared-plugin-distribution.md) | finalized | control-tower | 2026-08-03 |
| 002 | [openIndu 全组织 Agent 清点与收敛](./002-agent-consolidation.md)                          | finalized | control-tower | 2026-08-03 |
| 003 | [Agent 组织架构重构——按能力编制，与仓库数量解耦](./003-agent-org-design.md)               | finalized | control-tower | 2026-08-03 |
