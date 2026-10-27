---
spec_id: 005-org-dev-workflow
title: 组织级开发流水线 /dev——把 platform 的开发 workflow 提升为全组织 workflow
status: draft # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-10-27
updated: 2026-10-27
supersedes:
related_repos:
  - control-tower
  - openindu-platform
  - openindu-studio
implementing_agents:
  - control-tower
related_rules:
  - RULE 2
  - RULE 3
  - RULE 4
  - RULE 5
  - RULE 6
  - RULE 7
  - RULE 8
  - RULE 10
  - RULE 11
---

# 组织级开发流水线 /dev——把 platform 的开发 workflow 提升为全组织 workflow

## 1. 背景（WHY）

现状有三层，彼此没有衔接：

| 层         | 位置                                                                               | 状态                                                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单仓流程   | `openindu-platform/.claude/governance/development-workflow.md`（v1.0，2026-06-12） | 06-12 后未改；§6 写着 manifest / launch「重构阶段再建」，实际 06-15 已有；`team/manifest.yaml` 的 `file:` 相对路径解析不到文件；仍依赖 6 条守则的本地 `PRINCIPLE.md` 副本；在 spec/002 的 `/adopt` 收敛清单上，但 platform 尚未 adopt |
| 组织技能链 | 插件 `/launch → /design → /autopilot → /issue-pipeline → /delivery-check`          | `/issue-pipeline` 做到「收集 → 分诊 → 对抗评审 → 派发 → PR 绿」就停，合并必须人工；它扫的是整个组织的 backlog，而不是「一个仓库从 issue 做到可本地验证」                                                                              |
| 使用者要求 | 2026-10-27，维护者（用户）                                                         | 把 platform 的 workflow 提升为组织级，入口 `./dev <project>`，流程六步（见 §2.1）；并决定对整个 openIndu 组织开启合入绿灯（见 §2.3 与 spec/006）                                                                                      |

痛点：

1. issue → 方案 → 实现 → 合并，全靠人逐个分派、逐个确认；
2. 交互式会话里 `git push` 前的人工确认（本地 PreToolUse 钩子）会打断无人值守的批处理；
3. 合并之后没有统一的「本地起服务验证」入口；
4. platform 的流程文档只覆盖单仓，且已陈旧。

另有一个事实影响落地：2026-10-27 上午实测 `openIndu/openindu-studio` 没有 open issue；随后维护者建了 `openIndu/openindu-studio#76`（「请支持本地编译构建运行 openindu-studio」），作为首个真实验证目标（见 §4 阶段 6）。

## 2. 设计要点（WHAT）

### 2.1 一个入口，六步流水线

`./dev <repo>`（工作区启动器）与 `/dev <repo>`（技能）调用同一个 runner：`skills/dev/scripts/dev.mjs`。`<repo>` 取自 `route.json`；属于 §2.3 结构性排除类型的仓一律拒绝，其余仓按运行时准入条件决定能否自动合并。

| 步  | 要求                                            | EXECUTE（runner，确定性代码）                                                                                                                           | REASON（无头 `claude -p`，结构化输出）                      | 产出                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 从命令行获取该项目的 issue                      | `gh api` 取 open issue（复用 `collect-org-issues.mjs`，增加 `--repo`），剔除 PR，要求 `complete: true`；0 个 issue 则干净退出                           | —                                                           | `snapshot.json`                                                      |
| 2   | 逐个 issue 多 agent 评审，选最优方案并固化      | 按复杂度确定评审小组（§2.2）；代码汇总评分并选最高分（LLM 不做算术）；写文件                                                                            | N 个独立方案提案 → 评审打分 → 仲裁                          | 每个 issue 一份 `issue-<n>-solution.md`（含被否方案与评分表）        |
| 3   | 按方案实施，多 agent 评审并解决意见             | 每个 issue 一个独立 worktree 与分支；本地确定性门禁（格式 / lint / 测试）先于评审；统计 diff 规模                                                       | 实现；四视角评审（正确性 / 安全 / 可维护 / 架构一致）；修复 | 代码、`issue-<n>-review.md`；评审与修复各最多 2 轮，超出 → `BLOCKED` |
| 4   | 每个 issue 提 PR，CI 绿后自动合入，不再手动确认 | 提交（署名取自 route）、推送功能分支、开 PR、轮询检查、**合并守卫**（§2.3）、`gh pr merge --squash --delete-branch --match-head-commit <sha>`、读回核对 | CI 失败时诊断与修复（最多 2 次）                            | PR、合并读回                                                         |
| 5   | 全部 PR 完成后，本地构建并起测试服务            | 在独立的验证 worktree 拉默认分支；按 `dev.local_service` 构建启动；先检查「不指向生产」；探活                                                           | 从各 issue 的验收标准生成人工验证清单                       | `verify-checklist.md`、运行中的本地服务                              |
| 6   | 本地通过后可执行 `/build` 推送镜像仓库          | 独立子命令 `./dev build <repo>`，仅在用户确认后运行；数据取自 `dev.build`；无镜像的仓报告 N/A                                                           | —                                                           | 镜像标签；RULE 11 ③–⑥ 状态清单                                       |

结构性约束：

- **RULE 3**：循环、轮询、合并、起服务都是代码；LLM 只负责推理，每次输出经 JSON Schema 校验，失败重试 ≤2 次后降级。
- **agent 不持有 push / 开 PR / 合并的能力**：agent 只在工作树里改文件，`--disallowedTools` 禁用相关命令，并有测试断言。这些动作只由 runner 执行，所以交互式会话里针对 agent 工具调用的 push 确认钩子保持原样、不被削弱；runner 的推送本身受 §2.3 守卫约束。
- **可恢复、可审计**：每次运行有 run-id 与 `state.json`，每步幂等（不重复开 PR、不重复合并），可 `--resume`；同一仓同时只允许一个运行（锁文件）。
- **工作区隔离**：所有改动发生在该仓的临时 worktree（每个 issue 一个），不碰使用者正在用的检出。
- **控制开关**：`--dry-run`（做到步骤 2 为止，对 GitHub 零写入）、`--only <n,…>`、`--max-issues`（默认 10）、`--no-merge`、`--resume <run-id>`。
- **并行边界**：步骤 2 对所有 issue 只读且互相独立，可并行（上限 3）；步骤 3–4 在同一仓内串行，避免互相冲突。
- **文档目录**：方案与评审记录写入工作区文档目录，默认 `mem_docs/<repo>/dev-runs/<run-id>/`，可由环境变量 `OPENINDU_DOCS_DIR` 覆盖；每次运行新建、不覆盖历史产物（RULE 6）。
- **薄 issue**：验收标准缺失但意图清楚的 issue，由评审小组推导验收标准并标注「小组推导」，写进方案和 PR 正文；意图不清或互相矛盾才落到 `NEEDS_TRIAGE`。

### 2.2 评审小组按复杂度缩放（吸收 platform §1.0 轻量路径）

给一行 typo 套满编评审，正是 RULE 3 警告的「在 if/else 处包 agent」。档位先由确定性规则判定（标签、方案声明的路径与预估行数），仅在边界处才让 LLM 判断：

| 档位      | 判定（默认值）                                         | 方案阶段                                                                                  | 实施评审                   |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------- |
| Lite      | 单模块、≤L1、预估 ≤50 行、仅文档 / 文案 / 配置文本     | 1 提案 + 1 评审                                                                           | 1 评审                     |
| Standard  | 默认                                                   | 3 个独立提案（最小改动 / 稳健性 / 架构契合）→ 3 个评审（正确性、安全、可维护+架构）→ 仲裁 | 四视角各 1 评审            |
| High-risk | 触及鉴权、密钥、CI 配置、迁移、公共 API 契约，或跨模块 | Standard + security、test 挑战者；契约先行                                                | Standard + security + test |

需要 L3 动作（生产部署、删数据、改权限、改密钥、生产 SQL）的 issue 不进入实施：标 `HUMAN_REQUIRED`，方案照常固化，runner 不动手。

### 2.3 自动合并：组织级常设授权 + 确定性守卫 + 熔断器

维护者于 2026-10-27 决定对整个 openIndu 组织开启合入绿灯。它由四层共同成立，而不是 agent 自行决定合并：

1. **授权**：route.json 顶层 `dev_defaults.auto_merge` 记录组织级常设授权（`enabled`、`approved_by`、`approved_on`、`ref`、`requires_plugin_version`），所有仓继承；仓库可在自己的 `dev.auto_merge.enabled` 里退出，但不能越过第 2 条。`--no-merge` 随时关闭，PR 保留给人工。条文依据见 spec/006；已加载的插件版本低于 `requires_plugin_version` 时 runner 拒绝自动合并——规则文本与行为不得背离。
2. **结构性排除**（按 route 的 `type` 判定，数据不能覆盖）：`control-tower`（守则 / agent / hook 的唯一来源，走 spec + arbiter）、`aggregate`（子模块指针 PR 与 RULE 11 接力，首版不支持）、`gitops`（RULE 8：清单变更与 apply 由人完成，且在 Gitee）、`fork`（上游拥有合并权）、`meta`（组织级策略与模板，影响所有仓）。这些仓的 PR 一律留给人。
3. **运行时准入**（无需逐仓配置；不满足 → 退化为 PR-only：流水线照跑、照开 PR，但不合并）：A1 默认分支上至少有一个 CI 工作流；A2 默认分支最近一次 CI 为绿；A3 PR 上至少出现 1 个检查。
4. **守卫**（全部满足才合并；任一不满足 → `HUMAN_MERGE_REQUIRED`，PR 保留并写明原因）：
   - G1 PR head SHA = 已评审 SHA = CI 评估的 SHA（`--match-head-commit` 用完整 SHA）；
   - G2 必需检查全部 `SUCCESS`。必需集合取 `dev.required_checks`（若声明）与分支保护要求（若有）的并集；两者都没有时取「head SHA 上已出现的全部检查」，且至少 1 个。缺失、pending、cancelled、neutral、`action_required`、被跳过的必需项都不算绿；
   - G3 评审记录无未解决的 must-fix；
   - G4 变更路径 ⊆ 方案声明路径 ∪ 测试 / 文档，且不触及受保护路径：CI 工作流、CODEOWNERS、密钥与环境文件、K8s / 部署清单、数据库迁移、鉴权与权限配置、守则 / agent / hook / settings 文件、依赖声明与锁文件。各仓只能在默认清单上加，不能减；
   - G5 规模 ≤400 行且 ≤1 个模块边界（RULE 4）；
   - G6 风险 ≤L2；
   - G7 非 draft、无冲突、可合并；
   - G8 默认分支最近一次 CI 为绿。

熔断：合并后默认分支 CI 变红、连续 2 个 issue `BLOCKED`、或工具连续报错 → 停止后续合并，只出报告（RULE 4 的强制降级信号）。

合并一次一个：合并后等默认分支 CI，下一个 PR 按需 update-branch 并重新等 CI。合并方式固定 squash（线性历史，回滚是单个 `git revert`）；runner 在报告里给出每个 PR 的回滚命令，**不自动执行**。runner 在代码里拒绝向默认分支直接 push（RULE 7）。合并前重读 PR 状态：个别仓自带的合并自动化已合并过的，按成功处理并读回核对，不重复合并。

**与 RULE 5.2 / RULE 4 的关系——字面冲突，处理方式是改条文，不是绕过。** RULE 5.2 要求「agent 产出的 PR 合并前必须经人工评审」，且不得由另一个 agent 作为 L2+ 变更的唯一评审人；RULE 4 把合并到主干定为 L2（单人审批）。上述自动合并与这两条字面冲突，所以由 spec/006 按 principle 修改流程修订条文（组织级常设授权，守卫之下才生效）。006 的条文合入之前，runner 不会自动合并。

流水线里唯一必经的人工点是步骤 5 的本地验证，而它发生在合并**之后**。想要「先验证再合」的运行用 `--no-merge`。

### 2.4 数据契约：route.json 的 `dev` 字段

运行参数是数据，不写进 runner（控制层不枚举具体仓库，见 CLAUDE.md）。字段均可省略，省略即保守默认：

| 字段                                      | 位置       | 含义                                                                 | 默认                                           |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `dev_defaults`                            | route 顶层 | 组织级默认：`auto_merge` 常设授权、默认署名要求                      | 无 → 不自动合并                                |
| `dev.enabled`                             | 仓         | 是否允许 `/dev` 操作该仓                                             | 排除类型以外为 `true`；排除类型不可改为 `true` |
| `dev.default_branch` / `dev.merge_method` | 仓         | 基线分支 / 合并方式                                                  | 仓库默认分支 / `squash`                        |
| `dev.checks`                              | 仓         | 本地确定性门禁命令（格式、lint、测试），取自该仓 CI                  | 无 → 本地门禁交给实现 agent，以 CI 为准        |
| `dev.required_checks`                     | 仓         | 额外收紧：PR 上必须为 `SUCCESS` 的检查名                             | 无 → 见 G2                                     |
| `dev.auto_merge.enabled`                  | 仓         | 本仓退出自动合并                                                     | 继承 `dev_defaults`                            |
| `dev.commit`                              | 仓         | 署名与 DCO 要求（`co_authored_by`、`signoff`），有的仓要求 DCO 签署  | 继承 `dev_defaults`                            |
| `dev.protected_paths`                     | 仓         | G4 受保护路径；只能在默认清单上**加**                                | 默认清单                                       |
| `dev.local_service`                       | 仓         | 步骤 5 的构建 / 启动命令、健康检查地址、环境变量拒绝表（防指向生产） | 无 → 步骤 5 跳过并在报告中说明                 |
| `dev.build`                               | 仓         | 步骤 6 的构建推送入口；无镜像的仓为 `null`                           | `null`                                         |

### 2.5 从 platform 提升什么

| platform `development-workflow.md`     | 组织级对应                                                                        | 变化                                             |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| §0 manager → arbiter 编排 + 两处人工门 | runner（确定性编排）+ §2.2 评审小组                                               | 人工门改为「常设授权 + 合并后本地验证」，见 §2.3 |
| §1.0 轻量 / 完整路径判定               | §2.2 档位                                                                         | 保留，改为按档位缩放评审人数                     |
| §1.1 任务类型表                        | `suggested_flow`（fix / enhancement / design / research），沿用 `/issue-pipeline` | 沿用                                             |
| §2 五阶段                              | 步骤 2（设计）、3（实现 + 评审）、4（门禁 + 合并）、5（验收）                     | 「门禁左移」保留：本地确定性门禁先于评审         |
| 契约先行                               | High-risk 档：先产出契约再实现                                                    | 保留                                             |
| §3 反馈闭环（累计 3 轮）               | 每个环节最多 2 轮                                                                 | 与 RULE 3、`/autopilot`、`/issue-pipeline` 对齐  |
| §4 对抗式审查                          | High-risk 档的 security / test 挑战者                                             | 保留                                             |
| §5 角色缺口表、§6 启动入口             | 席位清单由插件提供 / `./dev`                                                      | 废止                                             |
| 写权限矩阵（execution-standard §2）    | agent 沙箱：仅工作树可写，禁 push / PR / 合并                                     | 由「约定」变为「工具层强制」                     |
| JaCoCo 20/12、`api_contract.py` 等     | platform 自己 route 里的 `checks` / `required_checks`                             | 留在 platform，不上收                            |

platform 的文档本身不在本 spec 中改动：它是已合入的治理文档（RULE 6）。本 spec 定稿后，另行向 owner 说明原因与影响并获确认，再把它收敛为「platform 特有部分」并附变更记录。

**未采纳的备选**

- 只做技能（SKILL.md 让主会话循环调度）：与 `/issue-pipeline` 同构、改动最小，但循环与合并交给 LLM 违背 RULE 3，长批次还会撞上下文压缩与逐条权限弹窗，无法无人值守。
- 合并到集成分支，批量一次人工合入主干：满足 RULE 5.2，但不是「CI 绿即合」。
- 先只给一个仓试点：blast radius 最小，但维护者已决定组织级；守卫、结构性排除、运行时准入、熔断与首跑 `--no-merge` 与具体仓无关，可以在组织范围内同样成立。

## 3. 影响范围

| 仓库                  | 影响文件 / 模块                                                                                                                                                            | 由谁落地                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| control-tower         | 本 spec、spec/006、`spec/README.md` 索引；后续 `skills/dev/**`、`reference/route.json`（及根同步产物）、`reference/manifest.yaml`、`ci.yml`（接入新测试）、插件次版本号 +1 | control-tower                      |
| openindu-studio       | 无文件改动；首个真实验证目标是 `openIndu/openindu-studio#76`；需先修正 route 里过时的 modules 与 release_flow（见 §8-6）                                                   | control-tower（route 数据）        |
| openindu-platform     | 定稿后的另一次改动：`development-workflow.md` 收敛为平台特有部分，另附变更记录                                                                                             | platform owner（先经 RULE 6 通知） |
| 其余仓库              | 无需改动即可按准入条件使用；声明 `checks` / `required_checks` 后更严                                                                                                       | —                                  |
| 工作区（不在 git 里） | `dev` / `dev.cmd` 两个薄启动器，指向插件里的 runner                                                                                                                        | 工作区 owner                       |

## 4. 实施路径（HOW）

每个 PR ≤400 行且在一个模块边界内（RULE 4）。runner 的测试必须接入 `ci.yml`——hook 测试曾长期存在却没接进 CI，不能重蹈。

### 阶段 1 — 评审本 spec 与 spec/006

- 起点：两份 spec `status: draft`。
- 改动：仅 spec 与 `spec/README.md` 索引。
- 验收：arbiter 按 5 个维度 `approved`（最多 3 轮）；维护者对 §2.3 的偏离明确表态。
- 回滚：不合并该分支。

### 阶段 2 — 条文修订与数据契约

- 起点：spec/005、spec/006 `finalized`。
- 改动：先合 spec/006 的条文修订 PR（见其 §4）；再合 PR-B：`route.json` 的 `dev_defaults`（含常设授权记录）与 `dev` 字段说明、studio 条目修正、`/route` 技能补一句说明、两份 route 同步、插件次版本号 +1。
- 验收：`node scripts/sync-route.mjs --check`、`node scripts/detect-modules.mjs --check` 通过。
- 回滚：revert 该 PR；`dev_defaults.auto_merge.enabled` 置 `false`。

### 阶段 3 — 确定性引擎（PR-C）

- 改动：路由解析、状态机、issue 收集（`collect-org-issues.mjs` 增加 `--repo`）、CI 状态分类、结构性排除与准入判定、合并守卫 G1–G8、受保护路径匹配、日志脱敏；≥20 条真值表用例；`ci.yml` 接线。
- 验收：全部用例通过，且对每条守卫「撤销守卫 → 对应用例变红」。
- 回滚：新增文件，直接 revert。

### 阶段 4 — 推理层（PR-D）

- 改动：无头 `claude -p` 调用器（`--json-schema`、`--max-budget-usd`、`--no-session-persistence`、工具白 / 黑名单）、评审小组、方案固化。
- 验收：以假 `claude` 夹具跑通 `--dry-run`：GitHub 零写入、每个 ACTION issue 产出方案文件。
- 回滚：revert。

### 阶段 5 — 实施、PR、CI、合并（PR-E）

- 改动：worktree 管理、提交与推送、PR 与 CI 轮询、合并与读回、熔断。
- 验收：以假 `gh` 夹具覆盖——CI 失败重试上限、head SHA 变化、默认分支变红、中途打断后 `--resume` 幂等、排除类型被拒。
- 回滚：revert；`dev.enabled` 置 `false` 即停用单个仓。

### 阶段 6 — 本地服务、build 门、入口（PR-F）

- 改动：`dev.local_service` 执行与「不指向生产」检查、`./dev build`、`/dev` 的 SKILL.md、两个启动器。
- 验收：先对 studio `--dry-run`；再用 `openIndu/openindu-studio#76` 以 `--no-merge` 跑通步骤 1–4。studio 目前没有 `local_service`，步骤 5 按规定跳过并报告——#76 要解决的正是本地编译构建运行，其 PR 合并后另起 route 数据 PR 登记 `dev.local_service`；最后才对 studio 去掉 `--no-merge`。
- 回滚：revert；`dev.enabled: false`。

## 5. 回滚方案

- 停用：把 route 里的 `dev_defaults.auto_merge.enabled` 置 `false`（一行数据），全组织立刻不再自动合并；单个仓用 `dev.enabled: false`。
- 全部撤回：engine 是新增文件，逐个 revert 各 PR；本 spec 标 `superseded`，不删除（RULE 6）。
- 已被自动合并的变更：每个 PR 是单个 squash 提交，用 `git revert <sha>`；熔断器限制一次运行内的连锁影响。
- platform 文档在 RULE 6 通知与确认前不动。

## 6. 验收标准

| #   | 标准                                                                                                           | 验证方式                                          |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | `--dry-run` 对 GitHub 零写入，且每个 ACTION issue 产出方案文件                                                 | 假 `gh` 记录调用，断言无写类调用                  |
| 2   | 合并守卫 G1–G8 的真值表 ≥20 条全绿，撤销任一守卫对应用例变红                                                   | 单元测试 + 手工撤销验证                           |
| 3   | agent 无法 push、开 PR、合并                                                                                   | 工具黑名单测试：对 `git push`、`gh pr` 的调用被拒 |
| 4   | 默认分支 CI 变红后停止合并                                                                                     | 夹具模拟                                          |
| 5   | 运行中被打断后 `--resume` 不重复开 PR、不重复合并                                                              | 夹具模拟                                          |
| 6   | 0 个 open issue 时干净退出并报告「0 项」                                                                       | 夹具                                              |
| 7   | 排除类型（`control-tower`、`aggregate`、`gitops`、`fork`、`meta`）全部被拒绝；不满足准入条件的仓退化为 PR-only | 夹具                                              |
| 8   | 插件版本低于 `requires_plugin_version` 时拒绝自动合并                                                          | 夹具                                              |
| 9   | 报告含逐 issue 验收矩阵（方案 / 评审 / PR / CI / 合并读回 / 状态），仅当每行每项读回通过才写 `Complete`        | 报告快照测试                                      |
| 10  | `ci.yml` 全绿，含新接入的测试                                                                                  | CI                                                |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ⚠️ 一处有意偏离：RULE 5.2 / RULE 4（合并前人工评审），由 spec/006 修订条文，006 合入前 runner 不自动合并，见 §2.3。其余：RULE 2（运行时准入 A1–A3 等价于 agent 准入）✅；RULE 3（确定性在代码、推理有 Schema）✅；RULE 4（≤400 行、L3 不实施、熔断）✅；RULE 5.4（issue 文本当不可信数据、凭据只走环境变量、日志脱敏）✅；RULE 6（platform 文档不动，方案文件每次运行新建不覆盖）✅；RULE 7（代码层拒绝直推默认分支，agent 无 push 能力）✅；RULE 8（gitops 类型排除）✅；RULE 10（生产 SQL 属 L3，不实施）✅；RULE 11（合并不等于交付，报告列出 ③–⑥ 状态）✅ |
| 跨仓契约对齐            | ✅ 契约是 route 的 `dev_defaults` 与 `dev` 字段（§2.4）；影响面见 §3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 与已定稿 spec 冲突检查  | spec/002 方向一致（子仓自带编排层向插件收敛）；spec/003 席位不变；`/issue-pipeline` 与 `/dev` 有重叠，见 §8-5                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 最小改动                | ✅ 以新增为主，分阶段 ≤400 行的 PR，首版不开放聚合仓与 gitops 仓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 回滚路径                | ✅ 见 §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 8. 待解决问题

- [x] 1. RULE 5.2 的处理：维护者 2026-10-27 决定对整个组织开启合入绿灯；条文修订见 spec/006。
- [ ] 2. 结构性排除清单（`control-tower`、`aggregate`、`gitops`、`fork`、`meta`）是否合适，`aggregate` 何时纳入。
- [ ] 3. 受保护路径默认清单——尤其依赖声明与锁文件是否一律交人；规模上限（400 行 / 1 模块）是否允许各仓放宽（建议只能收紧）。
- [ ] 4. 没有 `required_checks` 也没有分支保护时，用「head SHA 上已出现的全部检查，且至少 1 个」作回退是否足够。
- [ ] 5. `/dev` 与 `/issue-pipeline` 是否合并为一个技能：前者负责「单仓交付」，后者负责「全组织扫描与分诊」，分诊逻辑不应重复实现。
- [ ] 6. route 里 studio 条目已过时：写着 Python 99%、modules 为 converters / local-rag-mcp / scripts、「produces no container image」，而仓库根目录现有 `server/`、`web/`、`docker-compose.yml`，以及 `server/Dockerfile`、`web/Dockerfile`。步骤 6 对 studio 是否有目标，取决于这条的更正。
- [ ] 7. 无头 agent 的权限模式：`acceptEdits` 加工具白 / 黑名单（推荐），不使用 `--dangerously-skip-permissions`。
- [ ] 8. 步骤 5 的服务编排方式（docker compose 或本机进程），以及「不指向生产」的环境变量拒绝表如何定义。
- [ ] 9. 薄 issue（如 studio#76，正文只有一句话）的验收标准由评审小组推导并在 PR 正文列出，是否接受。
- [ ] 10. 个别仓自带的合并自动化与 runner 并存时的幂等处理细节。

## 9. 变更记录

| 日期       | 变更内容                                                                                                                            | 关联 revision |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 2026-10-27 | 初始草稿                                                                                                                            | —             |
| 2026-10-27 | 按维护者的决定改为组织级常设合并授权（新增结构性排除、运行时准入、`dev_defaults`），并指向 spec/006；首个真实验证目标定为 studio#76 | —             |
