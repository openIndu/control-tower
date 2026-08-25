# openIndu 团队启动指南

## 前置：接入公共插件

团队的守则与 agent 都由公共插件 `openindu-control-tower@openindu` 提供。**没接入插件，`/launch` 与 `/principle` 都不存在。**

在本仓，插件已通过 `.claude/settings.json` 自动引用。在其他 openIndu 仓库，跑一次：

```
/adopt
```

验证：

```
/plugin list          # 应看到 openindu-control-tower@openindu
/principle            # 应输出 11 条守则
```

---

## 一键启动

```
/launch
```

或附带初始任务：

```
/launch 把 openIndu-platform 的 PRINCIPLE.md 副本收敛到公共守则
```

`/launch` **自动检测团队状态**：

- 团队不存在 → 创建团队 + spawn manager
- 团队已存在、manager 运行中 → 直接发消息（不重复 spawn）
- 团队已存在、manager 已停止 → 只 spawn manager

**重复运行不会报错。**

## 启动后你看到什么

```
openindu-maintainers (Team)
    │
    ├── manager   ← 就绪，等你通过 @manager 下达任务
    │                 启动时执行：① /principle ② /route ③ git pull ④ git status
    │
    ├── arbiter   ← manager 收到任务时唤醒（任务分派审核 + spec 设计审核）
    │
    └── 5 repo agent / inspector ← manager 按任务 spawn

    副本规则（不限于 frontend）：
      同一个 agent 涉及 N 个同类型仓库时，manager 必须同一轮
      spawn N 个副本并行，每个副本 prompt 里写明 repo=<仓库名>。
      副本数是 spawn 参数，由 /route 的查询结果决定，
      不写死在 agent 定义里。
```

## Agent 启动强制流程

| 步骤  | 操作                   | 说明                                              |
| ----- | ---------------------- | ------------------------------------------------- |
| **1** | `/principle`           | Rule #1，会话第一步，上下文压缩后重新加载         |
| **2** | `/route`               | 确认仓库位置、类型、镜像、PR 走 GitHub 还是 Gitee |
| **3** | `git pull origin main` | 同步远端                                          |
| **4** | `git status`           | 确认工作目录干净                                  |

> 工作目录不干净时，agent 必须通知 manager 并停止，待人工清理后重启。

## 与 manager 交互

```
@manager 检查所有子仓 CLAUDE.md 是否符合 11 条守则
@manager 把 openIndu-backend 的 Dockerfile 多阶段构建优化
@manager 在 infra-deploy 仓为 web-api 加 SMS_SIGN_NAME 配置项
@manager 为新特性"用户头像上传"创建 spec 设计
```

manager 自动：

1. `/principle` + 读对应 agent 定义
2. Spawn arbiter 审核任务性质
3. **🛑 展示分派方案，等待确认（"go"）**
4. Spawn 对应 repo agent 执行
5. **对产出执行质量检查（对照验收标准逐项）**
6. **🛑 展示变更清单，等待确认（"go"）**
7. 汇总结果 + 用 `/delivery-check` 核对 RULE 11 交付链路

## 你可以随时

- **打断**：让 manager 暂停或调整方向
- **反馈**：对 repo agent 的产出提修改意见
- **决策**：遇到策略选择时由你拍板
- **否决**：拒绝不合理的方案

## 任务类型与流转

| 任务类型          | 处理流程                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| **通用规范/模板** | manager → arbiter 审核 → control-tower 统一处理 → 各 repo agent 同步   |
| **K8s 清单变更**  | manager → arbiter 审核 → infra-deploy agent 在 Gitee infra-deploy 仓改 |
| **跨仓协调**      | manager → arbiter 审核对齐 → 按依赖顺序派发 repo agent                 |
| **单仓独立**      | manager → arbiter 审核 → 直接派发对应 repo agent                       |
| **新 spec 设计**  | manager → control-tower `/spec-new` → arbiter 审核（≤3 轮）→ 定稿      |
| **生产数据库写**  | manager → **用户必审** → agent 提供 dry-run 脚本 → 人工执行（RULE 10） |
| **巡检改进**      | inspector 扫描 → manager → arbiter 审核 → 用户确认 → repo agent 执行   |

## RULE 11 交付链路提醒

任务完成时用 `/delivery-check` 生成完成度清单：

```
✅ 子仓 PR: openIndu/openIndu-backend#123
✅ 子仓合并: 已合
✅ 聚合仓 submodule 更新 PR: openIndu/openIndu-website#78
⏳ 镜像构建: 待 /build
⏳ infra-deploy PR: 待 manager 触发
⏳ kubectl apply: 待用户执行
```

⏳ 标记的步骤未完成，不算"任务完成"。

## 故障排查

| 问题                                     | 处理                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| `/principle` 或 `/launch` 不存在         | 插件没装或没启用，跑 `/adopt`，再 `/plugin list` 确认        |
| 插件改了但没生效                         | `/reload-plugins` 或重启会话；agents/hooks 改动必须重载      |
| `Agent type 'arbiter' not found`         | `subagent_type` 必须是 `general-purpose` 或 `claude`         |
| `Teammates cannot spawn other teammates` | spawn 时去掉 `name` 和 `team_name` 重试                      |
| manager 不响应                           | 删除 `~/.claude/teams/openindu-maintainers` 后重新 `/launch` |
| repo agent 产出不对                      | `@manager` 反馈修改要求，manager 会重新 spawn                |
| 跨仓冲突                                 | `@manager "升级到 arbiter"` 或描述冲突点                     |
| 工作目录脏                               | 人工清理未提交修改后重新启动 agent                           |
| spec 设计争议                            | arbiter 审核不通过时，control-tower 修订后重新提交           |
| 任务中断后恢复                           | 重新 `/launch`，manager 自动读 `TASK_LOG.md` 找未完成任务    |

## 子 Agent Spawn 规则

> **Team 是 flat 结构**，teammate 不能 spawn 其他 teammate。

**❌ 错误**（报 "Teammates cannot spawn other teammates"）：

```
Agent(name="arbiter", team_name="openindu-maintainers", ...)
```

**✅ 正确**（spawn 为普通 subagent）：

```
Agent(description="任务描述", subagent_type="general-purpose",
      mode="dontAsk", run_in_background=true, prompt="角色+任务")
```

| 类型              | 用途                                    |
| ----------------- | --------------------------------------- |
| `general-purpose` | **首选**，所有 repo agent 和 meta agent |
| `claude`          | 备选，`general-purpose` 不可用时        |
| `Explore`         | 只读代码搜索                            |
| `Plan`            | 架构设计                                |
