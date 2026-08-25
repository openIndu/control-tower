---
date: 2026-08-11
slug: drop-deleted-vision-repo
type: route
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/control-tower#28
---

# 移除已删除的 openindu-vision 条目，并修正两处与 route.json 冲突的 release_flow 表述

## Summary

`openindu-vision` 已于 2026-08-05 从 GitHub 删除，但 `route.json` 及两个 skill 仍在描述它，导致 `/route` 与 `/delivery-check` 会把一个不存在的仓当作有效路由目标返回。本次移除该条目，并顺带修正在同一批文本中发现的两处**与 `route.json`（唯一源）相冲突**的 release_flow 表述。

这是 `2026-08-04-complete-repo-census`（补全漏收的仓）的反向操作：普查解决"漏收"，本次解决"多留"。

## 事实核实（2026-08-11）

```
gh repo list openIndu --limit 30
→ 13 个仓，无 openindu-vision
```

与 `community` 仓 playbook §二 的记录一致（"openindu-vision（0KB 空壳）已于 2026-08-05 删除"）。此前 route.json 与该记录长期不一致，无人发现。

## 变更

| 文件                                                  | 变更                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/reference/route.json` | 删除 `openindu-vision` 条目（唯一源）                                                                                                                                                                                                       |
| `route.json`                                          | 由 `node scripts/sync-route.mjs` 重新生成                                                                                                                                                                                                   |
| `skills/route/SKILL.md`                               | ① 全景图中该行替换为 `openindu-station`（route.json 中 application 层的真实仓）；② Known data issues 的小写命名问题**改指 `openindu-station`**——命名不一致并未随 vision 删除而消失，station 同样是全小写；③ release_flow 一条拆开重写，见下 |
| `skills/delivery-check/SKILL.md`                      | 适用范围表拆行，见下                                                                                                                                                                                                                        |
| `plugin.json` / `marketplace.json`                    | 5.2.1 → **5.2.2**（改动了 plugin 内容，不 bump 则下游 `/plugin update` 取不到）                                                                                                                                                             |

## 顺带修正的两处事实错误（与唯一源冲突）

两处原文都断言 `openIndu-studio` **不在** `openIndu-website` 聚合仓内，但 `route.json` 明确记载它**就是第 4 个 submodule**（2026-08-05 对 `.gitmodules` 核实过），只是不产出镜像、`infra-deploy` 中无 manifest，因此 RULE 11 止于聚合仓的 submodule 指针 PR。

| 位置                                        | 原表述（错）                                                                                                           | 更正后                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `skills/route/SKILL.md` Known data issues   | `openIndu-studio` / `-platform` / `openindu-vision` / `-controller` 均为 `release_flow: "independent"`，都不在聚合仓内 | 拆为三类：platform/controller 为 independent；**studio 是第 4 个 submodule，止于 ③**；station 按自身流程 |
| `skills/delivery-check/SKILL.md` 适用范围表 | 同上四仓并作一行，标 "not in website aggregate"                                                                        | 拆两行，studio 单列并标 `① ② ③`                                                                          |

**为什么一并改**：这两行正是被 vision 污染的同一行文本；且 `/delivery-check` 依据它判定 RULE 11 的适用步骤——把 studio 误判为"不在聚合仓"会直接漏掉第 ③ 步（聚合仓 submodule 指针 PR），正是 RULE 11 要防的"applied but not live"。

## 未改动（RULE 6）

`spec/001` `spec/002` `spec/003` 与 `revision/` 下三份历史记录中亦提及 `openindu-vision`，**一律不动**——它们是当时的设计与变更记录，改写会破坏可追溯性。

## Verification

- [x] `node scripts/sync-route.mjs` — 源 → 根同步完成
- [x] `node scripts/sync-route.mjs --check` — 一致
- [x] `node scripts/check-roster.mjs` — 20 席位不变
- [x] `npx prettier --check "**/*.md"`
- [x] `claude plugin validate ./plugins/openindu-control-tower --strict`
- [x] `grep -c openindu-vision route.json` → 0

## Impact

| Scope      | Note                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Downstream | patch 5.2.1→5.2.2；`/route` 不再返回已删除的仓；`/delivery-check` 对 studio 的判定由"不在聚合仓"更正为"是第 4 个 submodule，止于 ③" |
| Rollback   | `git revert`；下游可 `/plugin install @5.2.1`                                                                                       |
| 遗留       | 小写命名不一致（`openindu-station`）仍未解决，需 GitHub 改名，已在 Known data issues 中继续跟踪                                     |
