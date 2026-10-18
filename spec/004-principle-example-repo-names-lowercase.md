---
spec_id: 004-principle-example-repo-names-lowercase
title: principle 里的示例仓库名跟随 GitHub 小写改名
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-10-18
updated: 2026-10-18
supersedes:
related_repos:
  - control-tower
implementing_agents:
  - control-tower
related_rules:
  - RULE 4
  - RULE 5
  - RULE 6
  - RULE 7
  - RULE 10
---

# principle 里的示例仓库名跟随 GitHub 小写改名

## 1. 背景（WHY）

2026-10-17 至 10-18，openIndu 组织内全部 GitHub 仓库名统一为全小写（`gh repo list openIndu` 的 15 个名字无一含大写字母）。`route.json` 与各技能行文已在 control-tower#11、#12 中跟进（见 `revision/2026-10-18-lowercase-repo-names-in-route.md`、`revision/2026-10-18-lowercase-remaining-repo-names.md`）。当时有意没动 `skills/principle/SKILL.md`：它是 11 条 RULE 的唯一来源，任何 RULE 正文的改动都要走其 `## Principle modification process`。

principle 里仍有 2 处点名仓库的示例是旧的驼峰写法：

| 位置                               | 原文                                                                       | 性质                                     |
| ---------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| RULE 7 · MUST 第 4 条（第 212 行） | Aggregate repo `openIndu-website` submodule pointer updates also go via PR | 聚合仓的仓库名                           |
| RULE 10 · WHEN（第 262 行）        | currently `openIndu-backend`'s `production_db`, see `plugins/…/route.json` | 生产库所属后端仓的仓库名，后面指向 route |

两处都是**仓库名**，不是路径。GitHub 对仓库名大小写不敏感，旧写法仍能解析，所以这不是故障；但 route 键以及 CI 的 `route.json covers every org repo` 一步是区分大小写比对的，留着驼峰会让「唯一来源」与 `route.json` 对同一个仓库的写法不一致，读的人（或 agent）拿这里的名字去 route / GitHub 里对照时对不上。

维护者（用户）于 2026-10-18 明确要求更新这两处（原话：「请帮我更新2,3」，其中 2 即本项）。该文件自 `b0af615`（v5.2.2 初始公开发布）起从未被修改过，没有先例可循。

## 2. 设计要点（WHAT）

- RULE 7 · MUST 第 4 条：`openIndu-website` → `openindu-website`。
- RULE 10 · WHEN：`openIndu-backend` → `openindu-backend`。
- 其余一字不动：RULE 的编号与标题、MUST / MUST NOT / CHECK 条目、组织名 `openIndu`（含 `openIndu/infra-deploy` 的 Gitee 链接）、镜像仓库路径 `openindu/`，以及本来就不含大写的名字。
- 随改动发 plugin patch 版本 5.4.2 → 5.4.3（`plugin.json` 与 `marketplace.json`），否则下游 `/plugin update` 取不到。

**未采纳的备选**

- 保持现状：零风险，但会留下与 route.json 写法不一致的「唯一来源」，下一次有人动这个文件时还得重新讨论。
- 把示例改成按类型表述（例如「aggregate-type repo，见 `/route`」）：更符合 CLAUDE.md「控制层不枚举具体仓库」的取向，但这是措辞与语义层面的改动，超出「跟随改名」的最小范围。需要的话另开 spec。

## 3. 影响范围

| 仓库          | 影响文件 / 模块                                                                                                   | 由谁落地      |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| control-tower | `plugins/openindu-control-tower/skills/principle/SKILL.md`（2 行）                                                | control-tower |
| control-tower | `plugins/openindu-control-tower/.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`（版本号）          | control-tower |
| control-tower | `spec/004-…`、`spec/README.md`（索引一行）、`revision/2026-10-18-principle-lowercase-example-names.md`            | control-tower |
| 其他仓库      | 无文件改动；`/plugin update` 之后读到新的示例文案。没有任何行为、权限或流程变化（被改的是示例标识符，不是规则）。 | —             |

## 4. 实施路径（HOW）

### 阶段 1 — 评审

- 起点：本 spec `status: draft`。
- 改动：仅本 spec 文件。
- 验收：arbiter 按 5 个维度给出 `approved`（最多 3 轮）。
- 回滚：不合并该分支即可，仓库无任何变化。

### 阶段 2 — 落地（一个 PR）

- 起点：本 spec `status: finalized`，并在 `spec/README.md` 加索引。
- 改动：principle 2 处、版本号 5.4.3、`revision/` 记录（`type: principle`，`related_spec: 004-principle-example-repo-names-lowercase`）。
- 验收：§6 全部通过；PR 的 CI 全绿；用户批准合并（L2，RULE 4 / 5.2）。
- 回滚：见 §5。

### 阶段 3 — 下游

- 起点：PR 合并。
- 改动：无强制动作，各仓下次 `/plugin update openindu-control-tower@openindu` 即获得 5.4.3。
- 验收：`claude plugin validate --strict` 对插件与 marketplace 均通过（CI 已覆盖）。
- 回滚：同 §5。

## 5. 回滚方案

整个变更是单个 PR 中的 2 行文案 + 版本号。回滚 = revert 该 PR，**并在 revert 里再 bump 一个 patch 版本**（5.4.4），否则已 `/plugin update` 的下游不会拿到回退。无需保留任何中间状态；旧写法在 GitHub 上始终可解析，因此回滚期间没有功能影响。

## 6. 验收标准

| #   | 标准                                                                        | 验证方式                                                                                                                                                         |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | principle 里不再出现任何驼峰仓库名                                          | 命令 1：改后无输出（阳性对照：对 `origin/main` 运行会命中第 212、262 行）                                                                                        |
| 2   | 只改了这 2 行                                                               | 命令 2：输出新增 2 行、删除 2 行                                                                                                                                 |
| 3   | 这 2 行的改动是且仅是两个名字的小写化                                       | 命令 3：无输出（对「还顺手改了别的字符」的编辑会报出差异，已用反例验证）                                                                                         |
| 4   | 11 条 RULE 与 `### 5.x` 小节的结构不变                                      | 命令 4：输出 `11 4`                                                                                                                                              |
| 5   | 两个新名字就是 `route.json` 里 `repos` 的键，且两份清单的版本号一致并已升级 | 命令 5：输出 `true 5.4.3 5.4.3`                                                                                                                                  |
| 6   | CI 全绿                                                                     | PR 上「format + plugin + route」通过（含 prettier、`sync-route --check`、`check-roster`、`claude plugin validate --strict`、Single principle source、hook 测试） |

命令在 control-tower 仓库根目录用 bash 执行：

```bash
P=plugins/openindu-control-tower/skills/principle/SKILL.md

# 1  改后应无输出
git grep -nE 'openIndu-(website|backend|admin|portal|studio|platform|controller|vision|cim|station)' -- "$P"

# 2  应显示新增 2 行、删除 2 行
git diff --numstat origin/main -- "$P"

# 3  应无输出：把改前文件里这两个名字小写化，必须与改后文件逐字相同
diff <(git show origin/main:$P | sed -e 's/openIndu-website/openindu-website/' -e 's/openIndu-backend/openindu-backend/') "$P"

# 4  应输出 11 4
echo "$(grep -c '^## RULE ' "$P") $(grep -c '^### 5\.' "$P")"

# 5  应输出 true 5.4.3 5.4.3
node -p "const r=require('./plugins/openindu-control-tower/reference/route.json'); [['openindu-website','openindu-backend'].every(k=>k in r.repos), require('./plugins/openindu-control-tower/.claude-plugin/plugin.json').version, require('./.claude-plugin/marketplace.json').plugins[0].version].join(' ')"
```

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ⚠️ **声明偏离 RULE 5.1，需用户在合并时接受。** principle 本身是 prompt，5.1 要求任何 prompt 变更（哪怕一个字符）上线前过 eval；仓库没有 eval 基础设施，≥20 条用例的模型 eval 做不到，arbiter 也无权豁免 RULE。本变更只改示例标识符的大小写、不改规则语义，以 §6 的程序化断言作为最小验证，并把这一偏离写进 revision。其余均满足：走完 spec → arbiter → revision → PR → 发版（`Principle modification process`）；只经 PR（RULE 7）；合并到主干是 L2，需用户批准（RULE 4）；principle 不是已完成任务产物，本 spec 定稿后同样不可变（RULE 6）。 |
| 跨仓契约对齐            | ✅ 不涉及接口、schema、错误码；下游只通过插件版本号获取新文案；两个新名字与 `route.json` 的键一致（§6 #5）。                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 与已定稿 spec 冲突检查  | ✅ 已核对 001（插件分发：principle 唯一源且改动必须发版，本 spec 照做）、002（agent 清点收敛）、003（agent 组织架构），均不涉及 principle 文案，无冲突。                                                                                                                                                                                                                                                                                                                                                                                      |
| 最小改动                | ✅ principle 只有 2 行、2 个标识符的大小写；整个 PR 约 6 个文件，远小于 RULE 4 的 400 行上限，且不跨模块边界。                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 回滚路径                | ✅ revert 单个 PR 并再 bump 一个 patch 版本（§5）；步骤可执行，无不可逆操作。                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 8. 待解决问题

已由 arbiter 第 1 轮裁定（2026-10-18）：

- [x] **RULE 5.1 是否适用**：适用。principle 是 prompt，5.1 明写「哪怕一个字符」，而 `Principle modification process` 没有列出 eval 步骤，故从严裁定。最小充分验证 = (a) 精确替换 diff（§6 #3）、(b) 两个新名字是 `route.json` 的 `repos` 键（§6 #5）、(c) 两份清单的版本号都是 5.4.3（§6 #5）、(d) CI 全绿（§6 #6）。≥20 条用例的模型 eval 仍未满足，且逐次变更无法满足（没有 harness）；arbiter 无权豁免 RULE，因此作为**声明偏离**记录，由用户在合并时接受；5.1 与修改流程的关系日后另行协调。
- [x] **是否把两处示例改成按类型表述（备选 2）**：不在本 spec 范围，推迟。需要的话另开 spec，并覆盖 RULE 7–10 里全部具体仓库名。

## 9. 变更记录

| 日期       | 变更内容                                                                                                                                                                                                                              | 关联 revision                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 2026-10-18 | 初始草稿                                                                                                                                                                                                                              | —                                               |
| 2026-10-18 | 提交 arbiter 第 1 轮：`revision_required`（仅文字修订）。§6 的验收命令因表格里的转义管道符无法直接执行（#1 在改前也没有输出，是一个不可能失败的检查），#3 的「都转小写再比较」会放过还顺手改了别处大小写的编辑；§7 第 1 行不应标 ✅。 | —                                               |
| 2026-10-18 | 按裁定修订：§6 命令移入围栏代码块；#3 改为精确替换 diff 并用反例验证；#5 加路由键断言与 node 命令；§7 第 1 行改为声明偏离 RULE 5.1；§8 记录裁定并删去先例论据。status → under_review，提交第 2 轮。                                   | —                                               |
| 2026-10-18 | arbiter 第 2 轮：approved（条件：定稿只改 status / updated / 本行；PR 描述标明声明偏离 RULE 5.1，用户明确接受后才合并）。status → finalized。                                                                                         | 2026-10-18-principle-lowercase-example-names.md |
