---
spec_id: 005-org-dev-workflow
title: 组织级开发流水线 /dev——把 platform 的 workflow 提升为全组织 workflow
status: under_review # draft | under_review | revision_required | finalized | superseded
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
  - RULE 1
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

# 组织级开发流水线 /dev——把 platform 的 workflow 提升为全组织 workflow

## 1. 背景（WHY）

现状有三层，彼此没有衔接：

| 层         | 位置                                                                               | 状态                                                                                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单仓流程   | `openindu-platform/.claude/governance/development-workflow.md`（v1.0，2026-06-12） | 06-12 后未改；§6 写着 manifest / launch「重构阶段再建」，但三者在同一个合并提交（`2a2957b`，06-12）里就都已存在，文档自合入起就是过时的；`team/manifest.yaml` 的 `file:` 相对路径从自身目录解析不到文件；仍依赖 6 条守则的本地 `PRINCIPLE.md` 副本；在 spec/002 的 `/adopt` 收敛清单上，但 platform 尚未 adopt |
| 组织技能链 | 插件 `/launch → /design → /autopilot → /issue-pipeline → /delivery-check`          | `/issue-pipeline` 做到「收集 → 分诊 → 对抗评审 → 派发 → PR 绿」就停，合并必须人工，且明确不另建第二套 SDLC；它扫的是整个组织的 backlog，而不是「一个仓库从 issue 做到可本地验证」                                                                                                                              |
| 使用者要求 | 2026-10-27，维护者（用户）                                                         | 把 platform 的 workflow 提升为组织级，入口 `./dev <project>`，流程六步（见 §2.1）；并决定对 openIndu 组织开启合入绿灯（见 §2.3 与 spec/006）                                                                                                                                                                   |

痛点：

1. issue → 方案 → 实现 → 合并，全靠人逐个分派、逐个确认；
2. 交互式会话里 `git push` 前的人工确认（本地 PreToolUse 钩子）会打断无人值守的批处理；
3. 合并之后没有统一的「本地起服务验证」入口；
4. platform 的流程文档只覆盖单仓，且已陈旧。

另有一个事实影响落地：2026-10-27 上午实测 `openIndu/openindu-studio` 没有 open issue；随后维护者建了 `openIndu/openindu-studio#76`（「请支持本地编译构建运行 openindu-studio」，正文只有一句话），作为首个流水线验证目标（见 §4 阶段 8）。

## 2. 设计要点（WHAT）

### 2.1 一个入口，六步流水线

`./dev <repo>`（工作区启动器）与 `/dev <repo>`（技能，`disable-model-invocation: true`）调用同一个 runner：`skills/dev/scripts/dev.mjs`。`<repo>` 取自 `route.json`。

| 步  | 要求                                            | EXECUTE（runner，确定性代码）                                                                                                                                                                                                                                                          | REASON（无头 `claude -p`，结构化输出）                      | 产出                                                                 |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | 从命令行获取该项目的 issue                      | `gh api` 取 open issue（复用 `collect-org-issues.mjs`，增加 `--repo`），剔除 PR，要求 `complete: true`；核对作者与评论者对本仓的 write 权限，记录正文哈希（G10）；0 个 issue 则干净退出                                                                                                | —                                                           | `snapshot.json`                                                      |
| 2   | 逐个 issue 多 agent 评审，选最优方案并固化      | 按复杂度确定评审小组（§2.2）；代码汇总评分并选最高分（LLM 不做算术）；写文件                                                                                                                                                                                                           | N 个独立方案提案 → 评审打分 → 仲裁                          | 每个 issue 一份 `issue-<n>-solution.md`（含被否方案与评分表）        |
| 3   | 按方案实施，多 agent 评审并解决意见             | 每个 issue 一个独立 worktree 与分支；本地确定性门禁（格式 / lint / 测试）先于评审；统计 diff 规模                                                                                                                                                                                      | 实现；四视角评审（正确性 / 安全 / 可维护 / 架构一致）；修复 | 代码、`issue-<n>-review.md`；评审与修复各最多 2 轮，超出 → `BLOCKED` |
| 4   | 每个 issue 提 PR，CI 绿后自动合入，不再手动确认 | 提交（署名取自 route）、推送功能分支、**先开 draft PR**、轮询检查；守卫 G1–G11 全过才转 ready 并 `gh pr merge --squash --delete-branch --match-head-commit <sha>`（禁 `--admin`）、读回核对                                                                                            | CI 失败时诊断与修复（最多 2 次）                            | PR、合并读回                                                         |
| 5   | 全部 PR 完成后，本地构建并起测试服务            | 在独立的验证 worktree 拉默认分支；按 `dev.local_service` 构建启动；先检查「不指向生产」；探活                                                                                                                                                                                          | 从各 issue 的验收标准生成人工验证清单                       | `verify-checklist.md`、运行中的本地服务                              |
| 6   | 本地通过后可执行 `/build` 推送镜像仓库          | 独立子命令 `./dev build <repo>`，仅在用户确认后运行，runner 不持有镜像仓库凭据（用户先 `docker login`）。`dev.build` 对 backend / admin / portal 指向聚合仓自己的 `/release`（不是插件的 `/build`），并要求 RULE 11 ③（子模块指针 PR）已合并，否则只报告 ⏳ 不构建；无镜像的仓报告 N/A | —                                                           | 镜像标签；RULE 11 ③–⑥ 状态清单                                       |

结构性约束：

- **RULE 3**：循环、轮询、合并、起服务都是代码；LLM 只负责推理，每次输出经 JSON Schema 校验，失败重试 ≤2 次后降级。
- **agent 不持有 push / 开 PR / 合并的能力**：agent 只在隔离环境的工作树里改文件，运行环境见 §2.6。这些动作只由 runner 执行，所以交互式会话里针对 agent 工具调用的 push 确认钩子保持原样、不被削弱；runner 的推送本身受 §2.3 守卫约束。
- **可恢复、可审计**：每次运行有 run-id 与 `state.json`，每步幂等（不重复开 PR、不重复合并），可 `--resume`；同一仓同时只允许一个运行（锁文件）；用 `--output-format stream-json` 采集脱敏后的完整轨迹，统计降级率、人工修正率、回滚率。
- **工作区隔离**：所有改动发生在该仓的临时 worktree（每个 issue 一个），不碰使用者正在用的检出。
- **控制开关**：`--dry-run`（做到步骤 2 为止，对 GitHub 零写入）、`--only <n,…>`、`--max-issues`（默认 10）、`--max-total-budget-usd`（单次运行总预算）、`--no-merge`、`--resume <run-id>`。
- **并行边界**：步骤 2 对所有 issue 只读且互相独立，可并行（上限 3）；步骤 3–4 在同一仓内串行，避免互相冲突。
- **文档目录**：方案与评审记录写入工作区文档目录，默认 `mem_docs/<repo>/dev-runs/<run-id>/`，可由环境变量 `OPENINDU_DOCS_DIR` 覆盖；每次运行新建、不覆盖历史产物（RULE 6）。
- **报告**：区分「已合并」与「Complete」；Complete 只在每行每项读回通过时才写（RULE 11：合并不等于交付，③–⑥ 逐项列状态）；PR 正文写明意图、爆炸半径、回滚方式、测试结果（RULE 4），附各守卫的取值与评审摘要。
- **薄 issue**：验收标准缺失但意图清楚的 issue，由评审小组推导验收标准并标注「小组推导」，写进方案和 PR 正文；这类 issue 一律 PR-only，除非有 write 权限的作者补上验收标准。意图不清或互相矛盾才落到 `NEEDS_TRIAGE`。
- **复用**：分诊复用 `/issue-pipeline` 的 schema（`ACTION` / `NEEDS_TRIAGE` / `NO_ACTION`）与收集器；`/issue-pipeline` 与 `/autopilot` 保持人工合并，不改。

### 2.2 评审小组按复杂度缩放（吸收 platform §1.0 轻量路径）

给一行 typo 套满编评审，正是 RULE 3 警告的「在 if/else 处包 agent」。档位先由确定性规则判定（标签、方案声明的路径与预估行数），仅在边界处才让 LLM 判断。**LLM 只能升档，不能降档**；confidence 低于 0.80、或评审自己表示不确定，一律转人工（沿用 `/issue-pipeline` 的阈值）：

| 档位      | 判定（默认值）                                         | 方案阶段                                                                                  | 实施评审                   |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------- |
| Lite      | 单模块、≤L1、预估 ≤50 行、仅文档 / 文案 / 配置文本     | 1 提案 + 1 评审                                                                           | 1 评审                     |
| Standard  | 默认                                                   | 3 个独立提案（最小改动 / 稳健性 / 架构契合）→ 3 个评审（正确性、安全、可维护+架构）→ 仲裁 | 四视角各 1 评审            |
| High-risk | 触及鉴权、密钥、CI 配置、迁移、公共 API 契约，或跨模块 | Standard + security、test 挑战者；契约先行                                                | Standard + security + test |

需要 L3 动作（生产部署、删数据、改权限、改密钥、生产 SQL）的 issue 不进入实施：标 `HUMAN_REQUIRED`，方案照常固化，runner 不动手。

### 2.3 自动合并：有期限、逐仓列名的常设授权 + 确定性守卫 + 熔断器

维护者于 2026-10-27 决定对 openIndu 组织开启合入绿灯，并选定形态：**组织级授权、逐仓列名、90 天有效期，授予与续期各走一次 L3 PR**。它由下面几层共同成立，agent 在任何一层都不持有合并权。

**1. 授权。** route.json 顶层 `dev_grants` 数组，每条含 `id`、`approved_by`（必须是授权人本人）、`approved_on`、`expires_on`（至多 90 天后）、`ref`（授予它的 L3 PR）、`principle_ref`（含 spec/006 条文的提交）、`repos`（逐个列名）。不在名单上的仓——包括之后新建的仓——不继承；过期、读不到、仓不在名单上都等于没有授权。授予、扩大、续期都是 L3（RULE 4）：回滚方式是撤销该条授权，dry-run 是名单内各仓的 `--no-merge` 运行报告。撤回随时可做，下一次合并前即生效（G11）。

**2. 谁不在名单上。**

- 结构性排除（按 route 的 `type` 判定，数据不能覆盖）：`control-tower`、`aggregate`、`gitops`、`fork`、`meta`。
- 设备侧仓（type 为 `station`、`controller`、`vision`、`cim`，或 `delivery_owner: station-control`）：在 route 里登记 `dev.safety_paths` 之前不得出现在任何授权里；登记之后，触及 `safety_paths` 的变更一律转人工（运动、电源、联锁相关默认 L3）。
- 运行时准入（RULE 2 的 agent 准入）：A1 默认分支上没有任何 CI 工作流 → **拒绝运行**（exit 3，不开 PR，不在没有 CI 的仓部署有写能力的 agent）；A2 没有人工声明的 `dev.required_checks`，或集合里缺少 `test` 与 `secret-scan` 两类 → 只开 PR（`PR_ONLY`）；A3 默认分支当前 HEAD 的 CI 不是 `SUCCESS` → 只开 PR。

**3. 守卫。** 全部满足才合并，任一不满足 → `HUMAN_MERGE_REQUIRED`，PR 保留并写明原因。守卫是最低要求：各仓只能加，不能减。

| ID  | 守卫                                                                                                                                                                                                                          | 取值来源                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G1  | PR head SHA = 已评审 SHA = CI 评估的 SHA（`--match-head-commit` 用完整 SHA）。update-branch 之后 head 变化：仅当 PR 自身 diff 的 patch-id 与评审时一致才沿用评审，且 CI 必须在新 head 上重跑；否则重新评审                    | `git patch-id`、`gh pr view`                |
| G2  | 必需检查全部 `SUCCESS`。必需集合 = 人工声明的 `dev.required_checks`（含 `test` 与 `secret-scan`）∪ 分支保护要求的检查。缺失、pending、cancelled、neutral、`action_required`、被跳过都不算绿——路径过滤导致测试没触发，就是缺失 | `gh pr checks`、保护 API                    |
| G3  | 独立评审无未解决的 must-fix；agent 评审只能否决合并，不能促成合并                                                                                                                                                             | 评审记录                                    |
| G4  | 变更路径 ⊆ 方案声明路径 ∪ 测试 / 文档，且不触及受保护路径（下表）；没有删除测试、新增 skip / xfail / only、降低覆盖率阈值                                                                                                     | `git diff`                                  |
| G5  | 规模 ≤400 行且 ≤1 个模块边界（RULE 4）；各仓不得放宽                                                                                                                                                                          | `git diff --numstat`                        |
| G6  | 风险 ≤L2；档位只升不降；confidence ≥0.80 且评审未表示不确定                                                                                                                                                                   | 方案记录                                    |
| G7  | PR 已由 runner 转为 ready；无冲突；可合并                                                                                                                                                                                     | `gh pr view`                                |
| G8  | 基线健康：默认分支**当前 HEAD SHA** 的 CI 为 `SUCCESS`，且 PR 已包含该 HEAD                                                                                                                                                   | `gh api`                                    |
| G9  | 变更路径的 CODEOWNERS 属主 ⊆ 授权人（RULE 5.3），否则转人工                                                                                                                                                                   | CODEOWNERS                                  |
| G10 | 来源：issue 作者与每个进入 agent 上下文的评论者对本仓有 write 权限；正文哈希与快照一致；验收标准不是「小组推导」                                                                                                              | `gh api …/collaborators/{u}/permission`     |
| G11 | 授权有效：合并前**实时**读取 control-tower 默认分支上的 route，授权存在、未过期、列有本仓，`principle_ref` 是默认分支的祖先；本机没有暂停标记（`.dev-pause`）；读取失败则不合并                                               | `gh api …/contents/…?ref=main`、compare API |

受保护路径（G4，默认清单）：

| 类别          | 例                                                                      |
| ------------- | ----------------------------------------------------------------------- |
| CI 与仓库治理 | `.github/workflows/**`、CODEOWNERS                                      |
| 密钥与环境    | `.env*`、密钥与证书文件                                                 |
| 部署          | K8s / 部署清单、Helm                                                    |
| 数据          | 数据库迁移                                                              |
| 鉴权与权限    | 鉴权、权限配置                                                          |
| 守则与 agent  | `.claude/**`、CLAUDE.md、AGENTS.md、守则 / agent / hook / settings 文件 |
| 依赖与子模块  | 依赖声明与锁文件、`.gitmodules` 与 gitlink                              |
| 测试闸门      | 覆盖率与测试运行器配置                                                  |
| 设备安全      | `dev.safety_paths`                                                      |

**4. PR 先开 draft。** runner 只在 G1–G10 全过后把 PR 转 ready，再合并。这也挡住个别仓自带的合并自动化（例如 station 的 `auto-merge.yml` 会在 build 通过后合并任何 OPEN 且可合并的 PR）：draft 状态下它们合不了。仍出现的**非 runner 合并**记为事故，触发熔断。

**5. 熔断即暂停授权。** 合并后默认分支 CI 变红、出现非 runner 合并、连续 2 个 issue `BLOCKED`、工具连续报错，任一发生就停止后续合并，并在本机写入暂停标记（工作区 `.dev-pause`）；此后所有运行只开 PR，直到维护者手动清除。任何一次回滚（revert）同样暂停。

**6. 合并执行。** 一次一个，合并后等默认分支 CI；方式固定 squash；禁止 `--admin`，不改分支保护和仓库设置；合并前重读 PR 状态；合并后读回（状态、合并提交、树与已评审 head 一致）。runner 在代码里拒绝向默认分支直接 push（RULE 7）。回滚命令写进报告，**不自动执行**。维护者在 72 小时内复核每次运行的合并报告，超时后下一次运行自动降为 PR-only。

**与 RULE 5.2 / RULE 4 的关系——字面冲突，处理方式是改条文，不是绕过。** RULE 5.2 要求「agent 产出的 PR 合并前必须经人工评审」，且不得由另一个 agent 作为 L2+ 变更的唯一评审人；RULE 4 把合并到主干定为 L2（单人审批）。上述自动合并与这两条字面冲突，所以由 spec/006 按 principle 修改流程修订条文。006 的条文合入、且授权名单（阶段 9）合入之前，runner 不会自动合并。

**维护者的书面接受（2026-10-27，对话中答复「agree」）。** 接受下列残余风险与单人 L3 授予：

| #   | 内容                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 同一模型做评审，误差会相互关联                                                                                                                                                         |
| R2  | 本地验证发生在合并**之后**（步骤 5）                                                                                                                                                   |
| R3  | 凡 main push 会发布制品的仓（例如 backend 的 main push 推送 GHCR `:latest`），`git revert` 撤不回已发布的镜像；这类仓在 route 里标 `dev.publishes_on_merge: true`，PR 正文和报告里写明 |
| R4  | 私有仓没有服务端分支保护兜底                                                                                                                                                           |
| R5  | L3 授予由维护者单人批准（组织只有 1 名成员，双人审批做不到）                                                                                                                           |

合并本 PR 视为对此的书面确认（做法同 spec/004）；阶段 9 的授予 PR 再逐项确认一次。

### 2.4 数据契约：route.json 的 `dev` 字段、状态与退出码

运行参数是数据，不写进 runner（控制层不枚举具体仓库，见 CLAUDE.md）。JSON Schema 放 `reference/dev.schema.json`（阶段 3），CI 校验。

| 字段                                      | 位置       | 含义                                                                                                 | 缺省                                    |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `dev_grants`                              | route 顶层 | 有期限、逐仓列名的合并授权（§2.3-1）                                                                 | 空 → 不自动合并                         |
| `dev.enabled`                             | 仓         | 是否允许 `/dev` 操作该仓（PR-only 也算操作）                                                         | `false`；排除类型不可改为 `true`        |
| `dev.default_branch` / `dev.merge_method` | 仓         | 基线分支 / 合并方式                                                                                  | 仓库默认分支 / `squash`                 |
| `dev.checks`                              | 仓         | 本地确定性门禁命令（格式、lint、测试），取自该仓 CI，同时是实现角色唯一放行的 Bash 命令              | 无 → 本地门禁交给实现 agent，以 CI 为准 |
| `dev.required_checks`                     | 仓         | 人工声明的必需检查：`{name, kind}`，`kind` 取 `test`、`secret-scan`、`lint`、`dco`、`build`、`other` | 无 → A2，只开 PR                        |
| `dev.safety_paths`                        | 仓         | 设备安全路径（§2.3-2）                                                                               | 设备侧仓无 → 不得入授权                 |
| `dev.protected_paths`                     | 仓         | 在默认清单上**加**的受保护路径                                                                       | 默认清单                                |
| `dev.publishes_on_merge`                  | 仓         | main push 是否发布制品（R3）                                                                         | `false`                                 |
| `dev.commit`                              | 仓         | 署名与 DCO 要求（`co_authored_by`、`signoff`），有的仓要求 DCO 签署                                  | 无署名                                  |
| `dev.local_service`                       | 仓         | 步骤 5 的构建 / 启动命令、健康检查地址、环境变量拒绝表（防指向生产）                                 | 无 → 步骤 5 跳过并在报告中说明          |
| `dev.build`                               | 仓         | 步骤 6 的入口；聚合子仓指向聚合仓的 `/release`；无镜像的仓为 `null`                                  | `null`                                  |

单个 issue 的终态：`MERGED`、`PR_GREEN`（只开 PR，CI 绿，等人合）、`HUMAN_MERGE_REQUIRED`、`HUMAN_REQUIRED`、`NEEDS_TRIAGE`、`NO_ACTION`、`BLOCKED`、`FAILED`。runner 退出码：

| 码  | 含义                                               |
| --- | -------------------------------------------------- |
| 0   | 全部完成（每行每项读回通过）                       |
| 1   | 参数错误或内部错误                                 |
| 2   | 部分完成（有 `BLOCKED` / `FAILED` / `HUMAN_*` 项） |
| 3   | 被拒绝：排除类型、未启用、A1 不满足                |
| 4   | 熔断：已写暂停标记                                 |
| 5   | 环境检查失败：§2.6 的阳性对照没过                  |

### 2.5 从 platform 提升什么

| platform `development-workflow.md`     | 组织级对应                                                                        | 变化                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| §0 manager → arbiter 编排 + 两处人工门 | runner（确定性编排）+ §2.2 评审小组                                               | 人工门改为「常设授权 + 合并后本地验证」，见 §2.3     |
| §1.0 轻量 / 完整路径判定               | §2.2 档位                                                                         | 保留，改为按档位缩放评审人数                         |
| §1.1 任务类型表                        | `suggested_flow`（fix / enhancement / design / research），沿用 `/issue-pipeline` | 沿用                                                 |
| §2 五阶段                              | 步骤 2（设计）、3（实现 + 评审）、4（门禁 + 合并）、5（验收）                     | 「门禁左移」保留：本地确定性门禁先于评审             |
| 契约先行                               | High-risk 档：先产出契约再实现                                                    | 保留                                                 |
| §3 反馈闭环（累计 3 轮）               | 每个环节最多 2 轮                                                                 | 与 RULE 3、`/autopilot`、`/issue-pipeline` 对齐      |
| §4 对抗式审查                          | High-risk 档的 security / test 挑战者                                             | 保留                                                 |
| §5 角色缺口表、§6 启动入口             | 席位清单由插件提供 / `./dev`                                                      | 废止                                                 |
| 写权限矩阵（execution-standard §2）    | agent 沙箱：仅隔离环境的工作树可写，禁 push / PR / 合并                           | 由「约定」变为「环境强制」                           |
| JaCoCo 20/12、`api_contract.py` 等     | platform 自己 route 里的 `checks` / `required_checks`                             | 留在 platform，不上收；platform 在 adopt 之前只开 PR |

platform 的文档本身不在本 spec 中改动：它是已合入的治理文档（RULE 6）。本 spec 定稿后，另行向 owner 说明原因与影响并获确认，再把它收敛为「platform 特有部分」并附变更记录。

### 2.6 agent 运行环境（隔离与凭据）

无头 agent 默认继承维护者的 gh / git 凭据、MCP 服务与用户级配置；工具黑名单拦不住 `gh api -X PUT …/merge`，也拦不住先改测试脚本再 `npm test`。真正的边界是**环境**，不是黑名单：

- **凭据**：agent 进程用显式构造的最小环境（变量白名单），不含任何 `*TOKEN*`、`*SECRET*`、`*KEY*`、`GH_*`、`GITHUB_*`；`HOME`、`USERPROFILE`、`GH_CONFIG_DIR` 指向空的临时目录；git 的 credential helper 置空、`GIT_TERMINAL_PROMPT=0`。同一 OS 用户的进程仍可能读到 Windows 凭据管理器里的条目，所以无人值守运行要求 agent 在**读不到维护者凭据存储的载体**里执行（容器、WSL 发行版或独立低权限账户，只挂载该 issue 的 worktree，出站网络只放行模型 API 与包仓库）；做不到就不得无人值守，`/dev` 退化为人在场的交互模式。
- **模型调用**：用 `--bare`（不读 OAuth 与钥匙串，认证只认 `ANTHROPIC_API_KEY` 或 `apiKeyHelper`）加一把**单独的、有额度上限、可轮换**的 API key，只传给 agent 进程；`--max-budget-usd` 约束单次调用，runner 另管单次运行总预算。
- **工具与配置**：`--restricted`（去掉执行命令的内置工具、忽略 user / project / local 设置、把文件工具限制在工作目录内、拒绝 bypassPermissions）加 `--strict-mcp-config`（不加载任何 MCP 服务）。需要跑命令的角色（实现、修复）用 `--tools` 点名 `Bash`，再用 `--allowedTools` 只放行 `dev.checks` 里的命令；方案和评审调用不给 Bash。具体参数组合以阶段 5 在 CLI 2.1.311 上的实测为准，并固定 CLI 版本。
- **守则注入**：agent 的系统提示里显式注入 Rule #1 锚点与 control-tower 默认分支上当前的守则文本，不依赖目标仓有 `.claude/` 或 CLAUDE.md（studio 两者都没有 Rule #1）。
- **嵌套**：runner 在 agent 环境里设 `OPENINDU_DEV_ACTIVE=1`，嵌套调用 runner 时拒绝一切合并。
- **文本传递**：issue、评论与 LLM 的输出只经 argv 数组或文件传给子进程，不拼进 shell 字符串。
- **阳性对照**（§6 第 3 条）：在 agent 环境里，`gh auth status` 必须失败、`git push` 必须失败、`git credential fill` 必须取不到、环境里扫不到凭据类变量、读取 worktree 之外的路径必须被拒、MCP 工具列表必须为空；任一没过 → exit 5。

**未采纳的备选**

- 只做技能（SKILL.md 让主会话循环调度）：与 `/issue-pipeline` 同构、改动最小，但循环与合并交给 LLM 违背 RULE 3，长批次还会撞上下文压缩与逐条权限弹窗，无法无人值守。
- 合并到集成分支，批量一次人工合入主干：满足 RULE 5.2，但不是「CI 绿即合」。
- 组织级默认继承（新仓自动在授权内）：对维护者最省事，但授予本身是 L3 权限变更，新仓不应悄悄继承；改为逐仓列名加有效期。
- 只靠环境变量与工具黑名单隔离 agent：在 Windows 本机挡不住凭据管理器与 `gh api` 写调用；改为环境隔离加阳性对照。

## 3. 影响范围

| 仓库                  | 影响文件 / 模块                                                                                                                                                                                                                                                          | 由谁落地                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| control-tower         | 本 spec、spec/006、`spec/README.md` 索引；后续 `skills/dev/**`、`reference/route.json`（及根同步产物）、`reference/dev.schema.json`、`reference/manifest.yaml`、`evals/`、`ci.yml`（接入新测试）、`skills/delivery-check/SKILL.md` 里关于 studio 的一行、插件次版本号 +1 | control-tower                      |
| openindu-studio       | 无文件改动；首个流水线验证目标是 `openIndu/openindu-studio#76`；需先修正 route 里过时的 modules 与 release_flow                                                                                                                                                          | control-tower（route 数据）        |
| openindu-platform     | 定稿后的另一次改动：`development-workflow.md` 收敛为平台特有部分，另附变更记录；adopt 之前只开 PR                                                                                                                                                                        | platform owner（先经 RULE 6 通知） |
| 其余仓库              | 默认 `dev.enabled: false`；声明 `dev.required_checks` 并经 L3 授予 PR 列入名单后才可自动合并                                                                                                                                                                             | —                                  |
| 工作区（不在 git 里） | `dev` / `dev.cmd` 两个薄启动器，指向插件里的 runner                                                                                                                                                                                                                      | 工作区 owner                       |

## 4. 实施路径（HOW）

每个 PR ≤400 行且在一个模块边界内（RULE 4）。runner 的测试必须接入 `ci.yml`——hook 测试曾长期存在却没接进 CI，不能重蹈。

### 阶段 1 — 评审本 spec 与 spec/006

- 起点：两份 spec `under_review`。
- 改动：仅 spec 与 `spec/README.md` 索引；评审过程记在两份 spec 的 §9 和后续 revision（threads 不入库）。
- 验收：arbiter 按 5 个维度 `approved`（最多 3 轮）；维护者对 §2.3 的偏离与 R1–R5 书面确认（合并本 PR）。
- 回滚：不合并该分支。

### 阶段 2 — 守则条文（spec/006 的两个 PR）

- 先合 eval 套件 PR（对现行条文建基线），再合条文修订 PR；细节见 spec/006 §4。
- 回滚：revert 条文 PR（spec/006 §5 预先授权）。

### 阶段 3 — 数据契约（PR-B）

- 起点：006 的条文已合入。
- 改动：`reference/dev.schema.json`、字段说明、状态码与退出码表；所有仓 `dev.enabled` 缺省 `false`、`dev_grants` 为空；修正 studio 条目（modules、release_flow、`dev.build`）并同步 `delivery-check/SKILL.md` 里「studio 没有镜像」那一行；两份 route 同步；插件次版本号 +1。
- 验收：`node scripts/sync-route.mjs --check` 通过；`detect-modules --check` 在 CI 里看不到私有仓，所以在本地用有权限的 token 跑，输出贴进 PR。
- 回滚：revert。

### 阶段 4 — 确定性引擎（PR-C）

- 改动：路由与授权的实时读取、状态机、issue 收集（`--repo`）、来源检查、CI 状态分类、准入 A1–A3、守卫 G1–G11、受保护路径与测试完整性检测、日志脱敏、熔断与暂停标记；≥22 条真值表用例；`ci.yml` 接线。
- 验收：全部用例通过，且对每条守卫「撤销守卫 → 对应用例变红」。
- 回滚：新增文件，直接 revert。

### 阶段 5 — 隔离运行环境与推理层（PR-D）

- 改动：§2.6 的隔离载体与阳性对照；无头调用器（`--bare`、`--restricted`、`--strict-mcp-config`、`--json-schema`、`--max-budget-usd`、`--output-format stream-json`）；评审小组；方案固化；推理层 eval 套件。
- 验收：阳性对照全过；推理层 eval 达标（§6 第 11 条）。
- 回滚：revert。

### 阶段 6 — 实施、PR、CI、合并（PR-E）

- 改动：worktree 管理、提交与推送、draft 优先、PR 与 CI 轮询、合并与读回、熔断。
- 验收：以假 `gh` 夹具覆盖——CI 失败重试上限、head 变化、默认分支变红、非 runner 合并触发熔断、中途打断后 `--resume` 幂等、排除类型被拒。
- 回滚：revert；`dev.enabled` 置 `false` 即停用单个仓。

### 阶段 7 — 本地服务、build 门、入口（PR-F）

- 改动：`dev.local_service` 执行与「不指向生产」检查、`./dev build`、`/dev` 的 SKILL.md、两个启动器。
- 验收：§6 第 17、18 条。
- 回滚：revert。

### 阶段 8 — 验证（不授予合并权）

- 用 `openIndu/openindu-studio#76` 以 `--no-merge` 跑通步骤 1–4。#76 多半触碰受保护路径（compose、Dockerfile、脚本），适合验证流水线，不能用来验证合并路径；studio 目前没有 `local_service`，步骤 5 按规定跳过并报告——#76 要解决的正是本地编译构建运行，其 PR 合并后另起 route 数据 PR 登记 `dev.local_service`。
- 合并路径另选一个低风险 issue，先在一次性仓上验证，再在拟列入名单的仓上以 `--no-merge` 出报告。
- 交付物：推理层 eval 报告、各仓 `--no-merge` 运行报告。

### 阶段 9 — 授予（单独的 L3 PR）

- 改动：`dev_grants` 新增一条（逐仓列名、≤90 天），附 eval 报告、各仓 `--no-merge` 报告，以及维护者对 R1–R5 的逐项确认。
- 验收：维护者合并（L3：回滚方式是撤销该条授权；dry-run 是上面的报告）。
- 回滚：从 `dev_grants` 删除该条；下一次合并前即生效。

## 5. 回滚方案

- 撤销授权：从 `dev_grants` 删除对应条目，或本机放置 `.dev-pause`；runner 每次合并前实时读取，立刻生效，不等插件发版。
- 停用单个仓：`dev.enabled: false`。
- 全部撤回：engine 是新增文件，逐个 revert 各 PR；本 spec 标 `superseded`，不删除（RULE 6）。
- 已被自动合并的变更：每个 PR 是单个 squash 提交，用 `git revert <sha>`；熔断器限制一次运行内的连锁影响。**已发布的制品撤不回**（R3），这类仓的 PR 正文和报告里单独标出。
- platform 文档在 RULE 6 通知与确认前不动。

## 6. 验收标准

| #   | 标准                                                                                                                                                                                                                                    | 验证方式                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | `--dry-run` 对 GitHub 零写入，且每个 ACTION issue 产出方案文件                                                                                                                                                                          | 假 `gh` 记录调用，断言无写类调用              |
| 2   | 守卫 G1–G11 的真值表 ≥22 条（每条守卫至少 2 例：通过、拦截）全绿，撤销任一守卫对应用例变红                                                                                                                                              | 单元测试 + 手工撤销验证                       |
| 3   | 隔离阳性对照（§2.6）：agent 环境里 `gh auth status` 与 push 必须失败，`git credential fill` 取不到，环境无凭据类变量，worktree 之外的读取被拒，MCP 工具列表为空                                                                         | 对照测试；没过 → exit 5                       |
| 4   | 来源：非 write 权限者提的 issue 只开 PR；评论者无权限则其文本不进上下文；正文哈希在合并前变化 → 转人工                                                                                                                                  | 夹具                                          |
| 5   | 准入：A1 不满足 → exit 3 且不开 PR；A2 不满足 → `PR_ONLY`；路径过滤导致必需检查缺失 → `HUMAN_MERGE_REQUIRED`                                                                                                                            | 夹具                                          |
| 6   | 测试完整性：删除测试、新增 skip / xfail / only、降低覆盖率阈值 → 转人工                                                                                                                                                                 | 夹具                                          |
| 7   | draft 优先：每个 PR 先开 draft；夹具仓里带自动合并工作流时，draft 不被合并；非 runner 合并 → 事故、熔断、暂停标记                                                                                                                       | 夹具                                          |
| 8   | update-branch：补丁等价 → 沿用评审并重跑 CI；不等价 → 重新评审                                                                                                                                                                          | 夹具                                          |
| 9   | 基线：默认分支 HEAD 的 CI 非 `SUCCESS`、或 PR 不含该 HEAD → 不合并                                                                                                                                                                      | 夹具                                          |
| 10  | 设备侧仓无 `safety_paths` → 不得入授权、只开 PR；LLM 降档请求被忽略；confidence <0.80 → 转人工                                                                                                                                          | 夹具                                          |
| 11  | 推理层 eval：≥20 个真实案例（含历史 issue，以及注入、越界、超规模、删测试、预埋缺陷、密钥入 diff、需 L3 的 issue、设备安全 issue、薄 issue），程序化判分，与上一版回归对比（通过率、回归案例、耗时、成本）；固定模型、提示词与 CLI 版本 | `claude plugin eval`，报告附在阶段 8 交付物里 |
| 12  | 撤回：授权被删 / 过期 / 读取失败 / 有 `.dev-pause` → 不合并；熔断写暂停标记；`principle_ref` 不在默认分支祖先链上 → 不合并                                                                                                              | 夹具                                          |
| 13  | 运行中被打断后 `--resume` 不重复开 PR、不重复合并                                                                                                                                                                                       | 夹具                                          |
| 14  | 0 个 open issue 时干净退出并报告「0 项」；排除类型（`control-tower`、`aggregate`、`gitops`、`fork`、`meta`）全部 exit 3                                                                                                                 | 夹具                                          |
| 15  | 报告含逐 issue 验收矩阵（方案 / 评审 / PR / CI / 合并读回 / 状态），区分「已合并」与 Complete，列出 RULE 11 ③–⑥                                                                                                                         | 报告快照测试                                  |
| 16  | 轨迹：stream-json 轨迹脱敏落盘，报告含降级率、人工修正率、回滚率                                                                                                                                                                        | 夹具                                          |
| 17  | `dev.build`：聚合子仓走聚合仓 `/release` 且 ③ 未完成时只报告 ⏳；runner 不持有镜像仓库凭据                                                                                                                                              | 夹具                                          |
| 18  | `ci.yml` 接入新测试并全绿                                                                                                                                                                                                               | CI                                            |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ⚠️ 一处有意偏离：RULE 5.2 / RULE 4（合并前人工评审、L3 双人审批），由 spec/006 修订条文并由维护者书面接受（R1–R5），见 §2.3。其余设计上满足、待实现与验收：RULE 1（显式注入守则，§2.6）；RULE 2（准入 A1–A3 加推理层 eval）；RULE 3（确定性在代码、推理有 Schema）；RULE 4（≤400 行、L3 不实施、熔断）；RULE 5.1（§6 第 11 条）；RULE 5.3（schema、状态码、退出码、CODEOWNERS 守卫）；RULE 5.4（环境隔离加来源门槛，issue 文本当不可信数据）；RULE 6（platform 文档不动，方案文件每次新建）；RULE 7（代码层拒绝直推默认分支，agent 无 push 能力）；RULE 8（gitops 排除）；RULE 10（生产 SQL 属 L3，不实施）；RULE 11（合并不等于交付） |
| 跨仓契约对齐            | ✅ 契约是 route 的 `dev_grants` / `dev` 字段加 JSON Schema（§2.4）；影响面见 §3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 与已定稿 spec 冲突检查  | spec/002 方向一致（子仓自带编排层向插件收敛）；spec/003 席位不变；`/issue-pipeline` 与 `/autopilot` 保持人工合并，`/dev` 复用其收集器与分诊 schema，不另建第二套 SDLC（§2.1）                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 最小改动                | ✅ 以新增为主，分阶段 ≤400 行的 PR；授权逐仓列名、首版不开放聚合仓与 gitops 仓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 回滚路径                | ✅ 见 §5：授权即时可撤，不依赖插件发版；制品撤不回的风险已列为 R3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 8. 待解决问题

- [x] 1. RULE 5.2 的处理：维护者 2026-10-27 决定对组织开启合入绿灯；形态为逐仓列名、90 天、L3 授予（Q1=A）；条文修订见 spec/006。
- [x] 2. 结构性排除清单：`control-tower`、`aggregate`、`gitops`、`fork`、`meta`；设备侧仓在登记 `safety_paths` 前只开 PR；`aggregate` 另起 spec 再纳入。
- [x] 3. 受保护路径与规模：默认清单见 §2.3-3，依赖声明与锁文件一律交人；400 行 / 1 模块各仓不得放宽，只能收紧。
- [x] 4. 回退规则：去掉「至少 1 个检查」；没有人工声明且含 `test`、`secret-scan` 的必需检查集合就只开 PR（A2）。
- [x] 5. `/dev` 与 `/issue-pipeline`：不合并，`/dev` 复用收集器与分诊 schema，后者保持人工合并。
- [x] 6. studio 的 route 条目：阶段 3 修正后才可能被列入名单。
- [x] 7. 无头 agent 的权限模式：`--restricted` 加 `--strict-mcp-config` 加工具白名单，不用 `--dangerously-skip-permissions`；载体见 §2.6。
- [x] 8. 步骤 5：`dev.local_service` 声明 compose 或本机进程；环境变量含 `*PROD*`、或数据库主机不是回环 / 私网地址，则拒绝启动。
- [x] 9. 薄 issue：验收标准由小组推导的一律 PR-only（G10）。
- [x] 10. 与仓自带合并自动化并存：draft 优先加事故规则（§2.3-4）。
- [ ] 11. agent 隔离的具体载体（容器、WSL 发行版、独立低权限账户）在阶段 5 设计里定；验收是 §6 第 3 条的阳性对照，不是载体本身。

## 9. 变更记录

| 日期       | 变更内容                                                                                                                                                                                                                                                | 关联 revision |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 2026-10-27 | 初始草稿                                                                                                                                                                                                                                                | —             |
| 2026-10-27 | 改为组织级常设合并授权（新增结构性排除、运行时准入），并指向 spec/006；首个流水线验证目标定为 studio#76                                                                                                                                                 | —             |
| 2026-10-27 | arbiter 第 1 轮（PR #14 @`0cfefaf`）：005、006 均 `revision_required`，005 阻断项 B1–B7、006 阻断项 B1–B4。维护者答复：Q1=A（逐仓列名、90 天、授予与续期走 L3 PR）、Q2=agree（书面接受 R1–R5）、Q3=A（006 做 ≥20 例 eval）                              | —             |
| 2026-10-27 | 第 2 轮修订：B1 → §2.6；B2 → G10；B3 → A1–A3、G2、G4；B4 → §2.3-4、G1、G8；B5 → §2.2、§2.3-2；B6 → §6 第 11 条；B7 → G11、§5；S1–S5 采纳；关闭 §8-2 至 §8-10；更正 §1 里「06-15」为 06-12 同一提交；status 改 `under_review`；README 索引标题与正文对齐 | —             |
