---
spec_id: 002-agent-consolidation
title: openIndu 全组织 Agent 清点与收敛
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-08-03
updated: 2026-08-04
supersedes:
related_repos:
  - workflow-control-tower
  - openIndu-website
  - openIndu-platform
  - infra-deploy
implementing_agents:
  - control-tower
  - infra-deploy
related_rules:
  - RULE 1
  - RULE 5
  - RULE 6
  - RULE 7
---

# openIndu 全组织 Agent 清点与收敛

## 1. 背景（WHY）

`spec/001` 建立了公共插件，但只解决了**守则**的单一来源，**agent 本身仍然重复且未梳理**。

本 spec 完成一次全量清点，给出每个 agent 的处置结论。清点范围：本机已 clone 的 4 个仓 + 公共插件。

### 全量清点结果（2026-08-03 扫描）

扫描 `.claude/agents/` 下全部 32 个 `.md`（含插件 7 个）。`.claude/agents/` 是**递归**扫描的，子目录里的 `AGENT.md` 同样会注册。

| 仓库                  | .md 总数 | 真正注册为 agent | 不注册（缺 frontmatter） |
| --------------------- | -------- | ---------------- | ------------------------ |
| 公共插件              | 7        | **7**            | 0                        |
| `openIndu-platform`   | 20       | **14**           | 6                        |
| `openIndu-website`    | 4        | **0**            | **4**                    |
| `infra-deploy`        | 1        | **1**            | 0                        |
| `openIndu-studio`     | 0        | 0                | 0                        |
| `openIndu-controller` | 0        | 0                | 0                        |

### 三个立即可见的缺陷

1. **`openIndu-website` 的 4 个 agent 全部不注册。** `backend-developer.md` / `devops-engineer.md` / `frontend-developer.md` / `fullstack-developer.md` 都没有 YAML frontmatter——和 control-tower 迁移前的 `team/agents/*.md` 是同一个毛病。**这 4 个 agent 等于不存在**，写了 277 行没人用。

2. **`openIndu-platform` 的 `_TEMPLATE.md` 会注册成垃圾 agent。** 它的 frontmatter 是 `name: openindu-{agent-id}`——占位符没被当成占位符，一个名叫 `openindu-{agent-id}` 的 agent 真的进了命名空间。

3. **`openindu-coordinator` 是死代码。** 它自己没有 `description`（Claude 无从判断何时调用），而同仓 `openindu-manager` 的 description 明写「**取代旧 coordinator** 的"置信度自动执行"」。取代者与被取代者同时在册。

另外 6 个文档文件（`AGENT_REFERENCE.md` / `AGENT_SYSTEM.md` / `AGENT_VALIDATION.md` / `README.md` / `coordinator/OPTIMIZATION_REPORT.md` / `ui-ux-designer/USAGE.md`，合计 1659 行）躺在被递归扫描的 `.claude/agents/` 里。它们因缺 frontmatter 不会注册，但把 agent 目录当文档目录用，是下一个 `_TEMPLATE.md` 事故的温床。

## 2. 设计要点（WHAT）

按**职责层级**而非仓库归属重新划分，是本次收敛的核心判据：

| 层级              | 归属     | 判据                                 |
| ----------------- | -------- | ------------------------------------ |
| **L1 治理层**     | 公共插件 | 与技术栈无关，全组织行为应当一致     |
| **L2 交付层**     | 公共插件 | 绑定具体仓库，但仓库本身归公共编排管 |
| **L3 产品线专属** | 各仓自留 | 绑定该仓特有技术栈，公共层无等价物   |
| **L0 应删除**     | —        | 死代码、占位符、与 L1 重复           |

**关键澄清：`backend` / `frontend` 看似重复，实际不是。**

| 名字                          | 技术栈                 | 服务对象                     |
| ----------------------------- | ---------------------- | ---------------------------- |
| `openindu-workflow:backend`   | **FastAPI** / Python   | `openIndu-backend`           |
| `openindu-backend-developer`  | **Spring Boot** / Java | `openIndu-platform`          |
| `openindu-workflow:frontend`  | **React 19 + Vite**    | `openIndu-admin` / `-portal` |
| `openindu-frontend-developer` | **Vue 3 + UniApp**     | `openIndu-platform`          |

两条产品线技术栈完全不同。合并会造出一个既懂 FastAPI 又懂 Spring Boot、既写 React 又写 Vue 的四不像 prompt，反而降低质量。**保持分开，靠 `description` 里的仓库限定词区分**（公共插件的 description 已写明服务哪个仓）。

## 3. 影响范围

### 逐个处置结论

| #   | agent                         | 所在仓       | 层级 | 处置               | 理由                                                            |
| --- | ----------------------------- | ------------ | ---- | ------------------ | --------------------------------------------------------------- |
| 1   | `openindu-manager`            | platform     | L1   | **删除**           | 与 `openindu-workflow:manager` 同责，公共版覆盖全组织           |
| 2   | `openindu-arbiter`            | platform     | L1   | **删除**           | 同上                                                            |
| 3   | `openindu-inspector`          | platform     | L1   | **删除**           | 同上                                                            |
| 4   | `openindu-coordinator`        | platform     | L0   | **删除**           | 无 description；已被同仓 manager 明确取代（死代码）             |
| 5   | `openindu-{agent-id}`         | platform     | L0   | **删除**           | `_TEMPLATE.md` 占位符污染命名空间                               |
| 6   | 6 个文档 .md                  | platform     | L0   | **移出**           | 移到 `.claude/docs/agents/`，agent 目录只放 agent 定义          |
| 7   | `backend-developer.md`        | website      | L0   | **删除**           | 无 frontmatter，从未注册；职责由插件 `backend` 覆盖             |
| 8   | `frontend-developer.md`       | website      | L0   | **删除**           | 同上，由插件 `frontend` 覆盖                                    |
| 9   | `devops-engineer.md`          | website      | L0   | **删除**           | 同上，由插件 `infra-deploy` 覆盖                                |
| 10  | `fullstack-developer.md`      | website      | L0   | **删除**           | 无 frontmatter；职责与 7/8 重叠，无独立价值                     |
| 11  | `ops`                         | infra-deploy | L3   | **保留**           | 含 kubectl 实操细节，公共 `infra-deploy` 无等价物；见待解决问题 |
| 12  | `openindu-backend-developer`  | platform     | L3   | **保留**           | Spring Boot，公共层无等价物                                     |
| 13  | `openindu-frontend-developer` | platform     | L3   | **保留**           | Vue 3 + UniApp，公共层无等价物                                  |
| 14  | `openindu-ops-engineer`       | platform     | L3   | **保留**           | 绑定 platform 的数据库/服务器实操                               |
| 15  | `openindu-architect`          | platform     | L3   | **保留**           | 公共层无等价物                                                  |
| 16  | `openindu-product-manager`    | platform     | L3   | **保留**           | 公共层无等价物                                                  |
| 17  | `openindu-business-analyst`   | platform     | L3   | **保留**           | 公共层无等价物                                                  |
| 18  | `openindu-ui-ux-designer`     | platform     | L3   | **保留**           | 公共层无等价物                                                  |
| 19  | `openindu-test-engineer`      | platform     | L3+  | **保留，候选上收** | 角色通用，但正文与脚本绑定 Spring Boot/Vue，需重写才能上收      |
| 20  | `openindu-reviewer`           | platform     | L3+  | **保留，候选上收** | 同上                                                            |

**净变化**：删除 9 个（3 个 L1 重复 + 2 个 L0 垃圾 + 4 个从未注册的 website agent），移出 6 个文档，保留 10 个 L3 专属，公共层维持 7 个。

### 收敛后的目标状态

```
L1 治理层（公共插件，全组织统一）
  openindu-workflow:manager / arbiter / inspector / control-tower

L2 交付层（公共插件，按仓库）
  openindu-workflow:backend      → openIndu-backend（FastAPI）
  openindu-workflow:frontend     → openIndu-admin / -portal（React）
  openindu-workflow:infra-deploy → openIndu-website / infra-deploy

L3 产品线专属（各仓自留）
  openIndu-platform : architect / product-manager / business-analyst /
                      ui-ux-designer / test-engineer / reviewer /
                      backend-developer(Spring Boot) /
                      frontend-developer(Vue3) / ops-engineer
  infra-deploy      : ops
```

## 4. 实施路径（HOW）

### 阶段 1 — website（4 个空壳 agent）

- 起点：4 个 agent 全部不注册
- 改动：跑 `/adopt` 接入插件；删除 4 个无 frontmatter 的文件；把其中仓库特有的知识点（如有）并入该仓 `CLAUDE.md`
- 验收：`.claude/agents/` 为空或只剩确实需要的；`@openindu-workflow:` 下 7 个可见
- 回滚：revert 该仓 PR

### 阶段 2 — platform（重复 + 垃圾 + 文档）

- 起点：14 个注册项，含 3 个 L1 重复、2 个 L0 垃圾
- 改动：跑 `/adopt`；删 manager / arbiter / inspector / coordinator / `_TEMPLATE.md`；6 个文档移到 `.claude/docs/agents/`；`PRINCIPLE.md` 副本删除，Rule #1 指向 `/principle`
- **不动** 9 个 L3 专属 agent 及其 Python 脚本、模板
- 验收：`.claude/agents/` 下只剩 9 个 L3 定义；命名空间无 `openindu-{agent-id}`
- 回滚：revert 该仓 PR

### 阶段 3 — infra-deploy（Gitee）

- 改动：跑 `/adopt`；`ops` 保留但修掉硬编码路径 `/root/infra-deploy`
- **PR 标题与正文用英文**（RULE 9）
- 回滚：revert 该仓 PR

### 阶段 4 — 上收评估（可选，后续）

评估 `test-engineer` / `reviewer` 是否重写为技术栈无关版本上收进公共插件。需单独 spec，本 spec 不做。

## 5. 回滚方案

每仓一个独立 PR，互不依赖，可单独 revert。被删文件均可从 git 历史取回。删除动作由 `/adopt` 执行，该 skill 在删任何文件前**必须停下来等用户确认**（RULE 4 L2 / RULE 6）。

## 6. 验收标准

| #   | 标准                                       | 验证方式                                             |
| --- | ------------------------------------------ | ---------------------------------------------------- |
| 1   | 全组织不存在两个 agent 负责同一件事        | 重跑本 spec 的清点脚本，L1 层每个角色只出现一次      |
| 2   | 命名空间无占位符 / 无 description 的 agent | 检查所有 frontmatter 的 `name` 与 `description` 非空 |
| 3   | `.claude/agents/` 下不含非 agent 文档      | 目录内每个 `.md` 都有合法 frontmatter                |
| 4   | 各仓 `/principle` 输出 11 条               | 逐仓人工验证                                         |
| 5   | L3 专属 agent 与其脚本、模板零损失         | `git diff` 确认未触碰 platform 的 9 个 L3 目录       |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ✅ 删除动作走 `/adopt` 且必须人工确认（RULE 4 / RULE 6）；Gitee PR 英文（RULE 9）     |
| 跨仓契约对齐            | ✅ 收敛判据是职责层级，已逐个 agent 给出结论，无「等若干」式含糊                      |
| 与已定稿 spec 冲突      | ✅ 与 `001` 互补：001 收敛守则，002 收敛 agent；002 的阶段依赖 001 阶段 2 的 `/adopt` |
| 最小改动                | ✅ 每仓一个独立 PR；明确列出**不动**的 10 个 L3 agent，避免误伤                       |
| 回滚路径                | ✅ 每仓独立 revert                                                                    |

## 8. 待解决问题

- [ ] `infra-deploy` 的 `ops` agent 硬编码了 `/root/infra-deploy` 路径，且 description 为英文——是保留现状还是改为路径无关 + 中文？
- [ ] `openIndu-website` 的 4 个空壳 agent 里是否有值得抢救的仓库知识？删之前需人工过一遍正文（277 行）
- [ ] `openIndu-studio` / `openIndu-controller` / `openindu-vision` 三个仓完全没有 agent——是不需要，还是没来得及建？
- [ ] platform 的 `test-engineer`（353 行 + Python 脚本 + 6 个模板）与 `reviewer`（253 行）上收成本较高，是否值得
- [x] ~~根目录 `skills/codebase-analysis/`（PR #3）是 opencode 格式，放在根 `skills/` 下 **Claude Code 发现不到**。是否同时上收进公共插件的 `skills/`，让两个工具都能用~~ —— **2026-08-04 已上收**：移入 `plugins/openindu-workflow/skills/codebase-analysis/`，根 `skills/` 删除；全组织经插件拿到 `/codebase-analysis`

## 9. 变更记录

| 日期       | 变更内容                                                                                                                                                                                                                                                                                                                                           | 关联 revision                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 2026-08-03 | 初始草稿                                                                                                                                                                                                                                                                                                                                           | —                                                       |
| 2026-08-04 | 闭合与 spec/003 的执行顺序：本 spec 阶段 2（删 platform 重复）须在 spec/003 阶段 2 之后；platform 的 4 个 L1 重复（manager/arbiter/inspector/coordinator）+ L0 垃基本轮经 `/adopt` 删除；4 个语言重叠 L3（backend-developer/frontend-developer/test-engineer/reviewer）的折叠走 §8「上收评估」单开 spec，不经 /adopt 删。status draft→under_review | 2026-08-04-roster-cleanup-and-spec002-closure.md        |
| 2026-08-04 | §8 codebase-analysis 上收 open item 闭合：根 `skills/codebase-analysis` 移入 `plugins/openindu-workflow/skills/`，根 `skills/` 删除                                                                                                                                                                                                                | 2026-08-04-role-aware-roster-and-skill-consolidation.md |
